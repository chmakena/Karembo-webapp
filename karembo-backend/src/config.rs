use std::env;

/// Runtime configuration, read once at boot from the environment (`.env` is loaded
/// first when present).
#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub bind_address: String,
    pub jwt_secret: String,
    /// How long an access token stays valid.
    pub jwt_ttl_hours: i64,
    /// Origins allowed to call the API from a browser.
    pub allowed_origins: Vec<String>,
    /// The salon's wall-clock offset from UTC, in hours.
    ///
    /// Availability has to be reasoned about in the salon's local time: "Amina works
    /// 09:00-13:00 on Tuesdays" is a statement about Nairobi time, not UTC. Nairobi
    /// (EAT) is a fixed UTC+3 with no daylight saving, so a plain offset is exact
    /// here and avoids pulling in a full IANA timezone database. A salon in a
    /// DST-observing region would need `chrono-tz` instead.
    pub utc_offset_hours: i32,
    /// Minimum notice, in minutes, between "now" and a bookable slot.
    pub booking_lead_minutes: i64,
    /// How far ahead customers may book.
    pub booking_horizon_days: i64,
    /// Granularity of offered start times, in minutes.
    pub slot_step_minutes: i64,
    /// Cut-off, in hours before the appointment, for a customer self-cancelling.
    pub cancellation_cutoff_hours: i64,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        // A missing .env is fine; real deployments inject variables directly.
        let _ = dotenvy::dotenv();

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL must be set (see .env.example)".to_string())?;

        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| "JWT_SECRET must be set (see .env.example)".to_string())?;

        if jwt_secret.len() < 32 {
            return Err("JWT_SECRET must be at least 32 characters".into());
        }

        Ok(Self {
            database_url,
            bind_address: env::var("BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".into()),
            jwt_secret,
            jwt_ttl_hours: parse_env("JWT_TTL_HOURS", 24)?,
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".into())
                .split(',')
                .map(|origin| origin.trim().to_string())
                .filter(|origin| !origin.is_empty())
                .collect(),
            utc_offset_hours: parse_env("SALON_UTC_OFFSET_HOURS", 3)?,
            booking_lead_minutes: parse_env("BOOKING_LEAD_MINUTES", 60)?,
            booking_horizon_days: parse_env("BOOKING_HORIZON_DAYS", 60)?,
            slot_step_minutes: parse_env("SLOT_STEP_MINUTES", 15)?,
            cancellation_cutoff_hours: parse_env("CANCELLATION_CUTOFF_HOURS", 12)?,
        })
    }
}

fn parse_env<T>(key: &str, default: T) -> Result<T, String>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    match env::var(key) {
        Ok(raw) => raw
            .trim()
            .parse()
            .map_err(|err| format!("{key} is not a valid value: {err}")),
        Err(_) => Ok(default),
    }
}
