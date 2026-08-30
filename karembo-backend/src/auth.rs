use std::future::{Ready, ready};

use actix_web::{FromRequest, HttpRequest, dev::Payload, http::header, web};
use argon2::{
    Argon2, PasswordHasher, PasswordVerifier,
    password_hash::{Error as PasswordHashError, phc::PasswordHash},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    config::Config,
    error::{ApiError, ApiResult},
    models::UserRole,
};

/// Hash a plaintext password for storage.
///
/// argon2 0.6 generates the salt internally via `getrandom` and returns a PHC
/// string, so no separate salt handling or storage column is needed.
pub fn hash_password(password: &str) -> Result<String, PasswordHashError> {
    Argon2::default()
        .hash_password(password.as_bytes())
        .map(|hash| hash.to_string())
}

/// Check a plaintext password against a stored PHC hash.
///
/// A malformed stored hash is treated as a failed verification rather than an
/// error, so a corrupt row cannot be distinguished from a wrong password.
pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    match stored_hash.parse::<PasswordHash>() {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(err) => {
            log::error!("stored password hash is not valid PHC: {err}");
            false
        }
    }
}

/// JWT payload. `sub` carries the user id; `role` is included so routine
/// authorisation checks do not need a database round trip.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub role: UserRole,
    pub iat: i64,
    pub exp: i64,
}

pub fn issue_token(
    config: &Config,
    user_id: Uuid,
    email: &str,
    role: UserRole,
) -> ApiResult<(String, i64)> {
    let issued_at = Utc::now();
    let expires_at = issued_at + Duration::hours(config.jwt_ttl_hours);

    let claims = Claims {
        sub: user_id,
        email: email.to_string(),
        role,
        iat: issued_at.timestamp(),
        exp: expires_at.timestamp(),
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;

    Ok((token, expires_at.timestamp()))
}

fn decode_token(config: &Config, token: &str) -> Result<Claims, ApiError> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|err| {
        use jsonwebtoken::errors::ErrorKind;
        match err.kind() {
            ErrorKind::ExpiredSignature => {
                ApiError::unauthorized("Your session has expired. Please sign in again.")
            }
            _ => ApiError::unauthorized("Invalid authentication token."),
        }
    })
}

/// An authenticated caller of any role.
///
/// Used as a handler argument; extraction fails with 401 when the bearer token is
/// absent, malformed, or expired.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: UserRole,
}

impl AuthUser {
    /// Guard for resources owned by a specific user. Admins pass for any owner.
    pub fn require_self_or_admin(&self, owner_id: Uuid) -> ApiResult<()> {
        if self.role.is_admin() || self.id == owner_id {
            Ok(())
        } else {
            Err(ApiError::forbidden(
                "You do not have access to this resource.",
            ))
        }
    }
}

fn extract_claims(req: &HttpRequest) -> Result<Claims, ApiError> {
    let config = req
        .app_data::<web::Data<Config>>()
        .ok_or_else(|| {
            log::error!("Config missing from app data; auth extractor cannot run");
            ApiError::Internal
        })?
        .clone();

    let header_value = req
        .headers()
        .get(header::AUTHORIZATION)
        .ok_or_else(|| ApiError::unauthorized("Authentication required."))?
        .to_str()
        .map_err(|_| ApiError::unauthorized("Malformed Authorization header."))?;

    let token = header_value
        .strip_prefix("Bearer ")
        .or_else(|| header_value.strip_prefix("bearer "))
        .ok_or_else(|| {
            ApiError::unauthorized("Authorization header must use the Bearer scheme.")
        })?
        .trim();

    decode_token(&config, token)
}

impl FromRequest for AuthUser {
    type Error = ApiError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        ready(extract_claims(req).map(|claims| Self {
            id: claims.sub,
            email: claims.email,
            role: claims.role,
        }))
    }
}

/// An authenticated caller who must hold the `admin` role.
///
/// Extraction fails with 403 for a valid non-admin token, so admin routes cannot
/// be reached by forgetting a check inside the handler.
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl FromRequest for AdminUser {
    type Error = ApiError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        ready(extract_claims(req).and_then(|claims| {
            if claims.role.is_admin() {
                Ok(Self(AuthUser {
                    id: claims.sub,
                    email: claims.email,
                    role: claims.role,
                }))
            } else {
                Err(ApiError::forbidden("Administrator access required."))
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> Config {
        Config {
            database_url: "postgres://unused".into(),
            bind_address: "127.0.0.1:0".into(),
            jwt_secret: "a-test-secret-that-is-long-enough-32".into(),
            jwt_ttl_hours: 1,
            allowed_origins: vec![],
            utc_offset_hours: 3,
            booking_lead_minutes: 60,
            booking_horizon_days: 60,
            slot_step_minutes: 15,
            cancellation_cutoff_hours: 12,
        }
    }

    #[test]
    fn password_round_trips() {
        let hash = hash_password("correct horse battery staple").unwrap();
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("wrong password", &hash));
    }

    #[test]
    fn same_password_gets_distinct_hashes() {
        // Distinct salts mean identical passwords must not produce identical hashes.
        let first = hash_password("same-password").unwrap();
        let second = hash_password("same-password").unwrap();
        assert_ne!(first, second);
        assert!(verify_password("same-password", &first));
        assert!(verify_password("same-password", &second));
    }

    #[test]
    fn corrupt_stored_hash_fails_closed() {
        assert!(!verify_password("anything", "not-a-phc-string"));
    }

    #[test]
    fn token_round_trips_with_role() {
        let config = test_config();
        let user_id = Uuid::new_v4();
        let (token, _) = issue_token(&config, user_id, "admin@karembo.test", UserRole::Admin)
            .expect("token should issue");

        let claims = decode_token(&config, &token).expect("token should decode");
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.role, UserRole::Admin);
    }

    #[test]
    fn token_signed_with_another_secret_is_rejected() {
        let config = test_config();
        let (token, _) =
            issue_token(&config, Uuid::new_v4(), "a@b.test", UserRole::Customer).unwrap();

        let mut attacker = test_config();
        attacker.jwt_secret = "a-different-secret-also-long-enough".into();

        assert!(decode_token(&attacker, &token).is_err());
    }

    #[test]
    fn expired_token_is_rejected() {
        let mut config = test_config();
        config.jwt_ttl_hours = -1; // already past
        let (token, _) =
            issue_token(&config, Uuid::new_v4(), "a@b.test", UserRole::Customer).unwrap();

        assert!(decode_token(&config, &token).is_err());
    }

    #[test]
    fn customer_cannot_reach_another_users_resource() {
        let user = AuthUser {
            id: Uuid::new_v4(),
            email: "c@karembo.test".into(),
            role: UserRole::Customer,
        };
        assert!(user.require_self_or_admin(user.id).is_ok());
        assert!(user.require_self_or_admin(Uuid::new_v4()).is_err());
    }

    #[test]
    fn admin_can_reach_any_users_resource() {
        let admin = AuthUser {
            id: Uuid::new_v4(),
            email: "a@karembo.test".into(),
            role: UserRole::Admin,
        };
        assert!(admin.require_self_or_admin(Uuid::new_v4()).is_ok());
    }
}
