use actix_web::{HttpResponse, web};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::{
    auth::{AuthUser, hash_password, issue_token, verify_password},
    config::Config,
    error::{ApiError, ApiResult},
    models::{User, UserProfile},
};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub token: String,
    pub expires_at: i64,
    pub user: UserProfile,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub full_name: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

/// Basic shape checks. Deliberately permissive — the goal is to reject obvious
/// mistakes, not to police valid-but-unusual addresses.
fn validate_email(email: &str) -> ApiResult<String> {
    let trimmed = email.trim();
    let looks_like_email = trimmed.len() >= 3
        && trimmed.matches('@').count() == 1
        && !trimmed.starts_with('@')
        && !trimmed.ends_with('@')
        && trimmed.split('@').nth(1).is_some_and(|host| host.contains('.'));

    if !looks_like_email {
        return Err(ApiError::unprocessable("Enter a valid email address."));
    }
    Ok(trimmed.to_string())
}

fn validate_password(password: &str) -> ApiResult<()> {
    if password.chars().count() < 8 {
        return Err(ApiError::unprocessable(
            "Password must be at least 8 characters.",
        ));
    }
    if password.chars().count() > 128 {
        return Err(ApiError::unprocessable(
            "Password must be 128 characters or fewer.",
        ));
    }
    Ok(())
}

fn validate_full_name(name: &str) -> ApiResult<String> {
    let trimmed = name.trim();
    if trimmed.len() < 2 {
        return Err(ApiError::unprocessable("Enter your full name."));
    }
    Ok(trimmed.to_string())
}

fn normalise_phone(phone: Option<String>) -> Option<String> {
    phone
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub async fn register(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    body: web::Json<RegisterRequest>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();
    let email = validate_email(&body.email)?;
    let full_name = validate_full_name(&body.full_name)?;
    validate_password(&body.password)?;

    let password_hash = hash_password(&body.password)?;

    // Self-service registration always creates a customer. Elevating to staff or
    // admin is an administrative action, never something the caller can request.
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, full_name, phone, role)
         VALUES ($1, $2, $3, $4, 'customer')
         RETURNING id, email, password_hash, full_name, phone, role, created_at",
    )
    .bind(&email)
    .bind(&password_hash)
    .bind(&full_name)
    .bind(normalise_phone(body.phone))
    .fetch_one(pool.get_ref())
    .await?;

    let (token, expires_at) = issue_token(&config, user.id, &user.email, user.role)?;

    Ok(HttpResponse::Created().json(SessionResponse {
        token,
        expires_at,
        user: user.into(),
    }))
}

pub async fn login(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    body: web::Json<LoginRequest>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, full_name, phone, role, created_at
         FROM users WHERE lower(email) = lower($1)",
    )
    .bind(body.email.trim())
    .fetch_optional(pool.get_ref())
    .await?;

    // Same message and comparable work for "no such user" and "wrong password",
    // so the response does not reveal which emails are registered.
    let invalid = || ApiError::unauthorized("Incorrect email or password.");

    let Some(user) = user else {
        // Hash a throwaway password so a missing account costs roughly the same
        // time as a present one.
        let _ = hash_password(&body.password);
        return Err(invalid());
    };

    if !verify_password(&body.password, &user.password_hash) {
        return Err(invalid());
    }

    let (token, expires_at) = issue_token(&config, user.id, &user.email, user.role)?;

    Ok(HttpResponse::Ok().json(SessionResponse {
        token,
        expires_at,
        user: user.into(),
    }))
}

pub async fn me(pool: web::Data<PgPool>, caller: AuthUser) -> ApiResult<HttpResponse> {
    let profile = sqlx::query_as::<_, UserProfile>(
        "SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = $1",
    )
    .bind(caller.id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("Account no longer exists."))?;

    Ok(HttpResponse::Ok().json(profile))
}

pub async fn update_me(
    pool: web::Data<PgPool>,
    caller: AuthUser,
    body: web::Json<UpdateProfileRequest>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();

    let full_name = match body.full_name {
        Some(ref name) => Some(validate_full_name(name)?),
        None => None,
    };

    // COALESCE leaves omitted fields untouched. Phone is handled separately so an
    // explicit empty string can clear it.
    let profile = sqlx::query_as::<_, UserProfile>(
        "UPDATE users
         SET full_name = COALESCE($2, full_name),
             phone = CASE WHEN $3::boolean THEN $4 ELSE phone END
         WHERE id = $1
         RETURNING id, email, full_name, phone, role, created_at",
    )
    .bind(caller.id)
    .bind(full_name)
    .bind(body.phone.is_some())
    .bind(normalise_phone(body.phone))
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("Account no longer exists."))?;

    Ok(HttpResponse::Ok().json(profile))
}

pub async fn change_password(
    pool: web::Data<PgPool>,
    caller: AuthUser,
    body: web::Json<ChangePasswordRequest>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();
    validate_password(&body.new_password)?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, full_name, phone, role, created_at
         FROM users WHERE id = $1",
    )
    .bind(caller.id)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("Account no longer exists."))?;

    if !verify_password(&body.current_password, &user.password_hash) {
        return Err(ApiError::unauthorized("Current password is incorrect."));
    }

    let new_hash = hash_password(&body.new_password)?;

    sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
        .bind(caller.id)
        .bind(&new_hash)
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::NoContent().finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_ordinary_addresses() {
        assert!(validate_email("amina@karembo.co.ke").is_ok());
        assert!(validate_email("  spaced@example.com  ").is_ok());
        assert_eq!(
            validate_email("  spaced@example.com  ").unwrap(),
            "spaced@example.com"
        );
    }

    #[test]
    fn rejects_malformed_addresses() {
        for bad in [
            "no-at-sign",
            "@example.com",
            "trailing@",
            "two@@example.com",
            "nodot@example",
            "",
        ] {
            assert!(validate_email(bad).is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn enforces_password_length_bounds() {
        assert!(validate_password("short").is_err());
        assert!(validate_password("longenough1").is_ok());
        assert!(validate_password(&"x".repeat(129)).is_err());
    }

    #[test]
    fn requires_a_usable_name() {
        assert!(validate_full_name(" A ").is_err());
        assert_eq!(validate_full_name("  Amina Karisa ").unwrap(), "Amina Karisa");
    }

    #[test]
    fn blank_phone_becomes_none() {
        assert_eq!(normalise_phone(Some("   ".into())), None);
        assert_eq!(
            normalise_phone(Some(" +254700111222 ".into())),
            Some("+254700111222".into())
        );
        assert_eq!(normalise_phone(None), None);
    }
}
