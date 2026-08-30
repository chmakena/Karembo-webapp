mod auth;
mod availability;
mod config;
mod error;
mod models;
mod routes;
mod seed;

use std::time::Duration;

use actix_cors::Cors;
use actix_web::{App, HttpServer, http::header, middleware, web};
use sqlx::postgres::PgPoolOptions;

use crate::config::Config;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let config = Config::from_env().map_err(|err| {
        log::error!("configuration error: {err}");
        std::io::Error::other(err)
    })?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&config.database_url)
        .await
        .map_err(|err| {
            log::error!("could not connect to Postgres: {err}");
            std::io::Error::other(err)
        })?;

    // Migrations are embedded in the binary, so deploying the backend is enough to
    // bring the schema up to date; there is no separate migration step to forget.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|err| {
            log::error!("migrations failed: {err}");
            std::io::Error::other(err)
        })?;
    log::info!("migrations up to date");

    let seed_demo = std::env::var("SEED_DEMO_USERS")
        .map(|value| value.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);

    // Seeding failure is logged but not fatal — the API is still usable without
    // the demo accounts.
    if seed_demo
        && let Err(err) = seed::seed_demo_users(&pool).await
    {
        log::error!("demo user seeding failed: {err}");
    }

    let bind_address = config.bind_address.clone();
    log::info!("Karembo API listening on http://{bind_address}");

    let shared_config = web::Data::new(config.clone());
    let shared_pool = web::Data::new(pool);

    HttpServer::new(move || {
        // The API is token-authenticated and browser-called, so CORS is restricted
        // to the configured frontend origins rather than left open.
        let mut cors = Cors::default()
            .allowed_methods(vec!["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE])
            .max_age(3600);

        for origin in &config.allowed_origins {
            cors = cors.allowed_origin(origin);
        }

        App::new()
            .app_data(shared_config.clone())
            .app_data(shared_pool.clone())
            // Reject oversized bodies before they reach a handler.
            .app_data(web::JsonConfig::default().limit(64 * 1024))
            .wrap(middleware::Logger::default())
            .wrap(middleware::NormalizePath::trim())
            .wrap(cors)
            .configure(routes::configure)
    })
    .bind(bind_address)?
    .run()
    .await
}
