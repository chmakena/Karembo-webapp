use actix_web::{HttpResponse, ResponseError, http::StatusCode};
use serde::Serialize;

/// Every failure the API can surface to a client.
///
/// Anything that would leak internals (a SQL error, a hashing failure) collapses
/// into `Internal`: it is logged in full server-side but the client only sees a
/// generic message.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    NotFound(String),

    /// The request was well-formed but conflicts with current state — most often
    /// the slot was taken between the availability lookup and the booking write.
    #[error("{0}")]
    Conflict(String),

    #[error("{0}")]
    UnprocessableEntity(String),

    #[error("internal server error")]
    Internal,
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest(message.into())
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Unauthorized(message.into())
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Forbidden(message.into())
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound(message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }

    pub fn unprocessable(message: impl Into<String>) -> Self {
        Self::UnprocessableEntity(message.into())
    }

    /// Stable machine-readable code so the frontend can branch without string matching.
    fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "bad_request",
            Self::Unauthorized(_) => "unauthorized",
            Self::Forbidden(_) => "forbidden",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::UnprocessableEntity(_) => "unprocessable_entity",
            Self::Internal => "internal_error",
        }
    }
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    error: ErrorDetail<'a>,
}

#[derive(Serialize)]
struct ErrorDetail<'a> {
    code: &'a str,
    message: String,
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::UnprocessableEntity(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(ErrorBody {
            error: ErrorDetail {
                code: self.code(),
                message: self.to_string(),
            },
        })
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        // The exclusion constraint is the authoritative guard against double-booking.
        // Translate its violation into a 409 so the client can re-fetch availability
        // and show "that slot just went" rather than a generic failure.
        if let sqlx::Error::Database(ref db_err) = err {
            if db_err.constraint() == Some("bookings_no_staff_overlap") {
                return Self::Conflict(
                    "That time slot has just been taken. Please pick another.".into(),
                );
            }
            if db_err.constraint() == Some("users_email_lower_key") {
                return Self::Conflict("An account with that email already exists.".into());
            }
        }

        log::error!("database error: {err}");
        Self::Internal
    }
}

impl From<argon2::password_hash::Error> for ApiError {
    fn from(err: argon2::password_hash::Error) -> Self {
        log::error!("password hashing error: {err}");
        Self::Internal
    }
}

impl From<jsonwebtoken::errors::Error> for ApiError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        log::error!("jwt error: {err}");
        Self::Internal
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
