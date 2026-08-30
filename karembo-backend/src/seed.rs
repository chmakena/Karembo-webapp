use sqlx::PgPool;
use uuid::Uuid;

use crate::{auth::hash_password, models::UserRole};

/// Create the demo accounts if they are absent.
///
/// Passwords must be hashed with Argon2, which SQL migrations cannot do, so the
/// user rows are seeded here instead of in `migrations/`. This is idempotent: an
/// existing account is left untouched, including its password.
///
/// The credentials are intentionally well-known demo values. `SEED_DEMO_USERS=false`
/// disables this entirely, which is what a real deployment should do.
pub async fn seed_demo_users(pool: &PgPool) -> Result<(), sqlx::Error> {
    let demo_accounts = [
        (
            "admin@karembo.test",
            "karembo-admin",
            "Karembo Front Desk",
            Some("+254700000001"),
            UserRole::Admin,
        ),
        (
            "wanjiku@example.com",
            "karembo-demo",
            "Wanjiku Njoroge",
            Some("+254700111222"),
            UserRole::Customer,
        ),
        (
            "james@example.com",
            "karembo-demo",
            "James Mwangi",
            Some("+254700333444"),
            UserRole::Customer,
        ),
    ];

    for (email, password, full_name, phone, role) in demo_accounts {
        let existing: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM users WHERE lower(email) = lower($1)")
                .bind(email)
                .fetch_optional(pool)
                .await?;

        if existing.is_some() {
            continue;
        }

        let Ok(password_hash) = hash_password(password) else {
            log::error!("could not hash the seed password for {email}; skipping");
            continue;
        };

        sqlx::query(
            "INSERT INTO users (email, password_hash, full_name, phone, role)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(email)
        .bind(&password_hash)
        .bind(full_name)
        .bind(phone)
        .bind(role)
        .execute(pool)
        .await?;

        log::info!("seeded demo account {email} ({role:?})");
    }

    Ok(())
}
