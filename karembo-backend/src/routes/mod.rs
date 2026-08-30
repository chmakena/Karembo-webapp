pub mod admin;
pub mod auth;
pub mod bookings;
pub mod catalogue;

use actix_web::{HttpResponse, web};

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "karembo-backend",
    }))
}

/// Mount every route under `/api`.
///
/// Authorisation is carried by the handler's extractor rather than by path
/// prefix: `AuthUser` requires any valid token, `AdminUser` requires the admin
/// role. An admin route therefore cannot be left unguarded by mistake.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health))
            // --- session ---
            .service(
                web::scope("/auth")
                    .route("/register", web::post().to(auth::register))
                    .route("/login", web::post().to(auth::login))
                    .route("/me", web::get().to(auth::me))
                    .route("/me", web::patch().to(auth::update_me))
                    .route("/password", web::post().to(auth::change_password)),
            )
            // --- public catalogue ---
            .route("/services", web::get().to(catalogue::list_services))
            .route("/categories", web::get().to(catalogue::list_categories))
            .route("/services/{slug}", web::get().to(catalogue::get_service))
            .route("/staff", web::get().to(catalogue::list_staff))
            .route("/availability", web::get().to(catalogue::availability))
            .route(
                "/availability/days",
                web::get().to(catalogue::availability_range),
            )
            // --- customer bookings ---
            .service(
                web::scope("/bookings")
                    .route("", web::get().to(bookings::list_my_bookings))
                    .route("", web::post().to(bookings::create_booking))
                    .route("/{id}", web::get().to(bookings::get_booking))
                    .route("/{id}/cancel", web::post().to(bookings::cancel_booking))
                    .route(
                        "/{id}/reschedule",
                        web::post().to(bookings::reschedule_booking),
                    ),
            )
            // --- admin ---
            .service(
                web::scope("/admin")
                    .route("/overview", web::get().to(admin::overview))
                    .route("/bookings", web::get().to(admin::list_bookings))
                    .route(
                        "/bookings/{id}/status",
                        web::patch().to(admin::update_booking_status),
                    )
                    .route("/services", web::get().to(admin::list_all_services))
                    .route("/services", web::post().to(admin::create_service))
                    .route("/services/{id}", web::patch().to(admin::update_service))
                    .route("/services/{id}", web::delete().to(admin::retire_service))
                    .route("/staff", web::get().to(admin::list_all_staff))
                    .route("/staff", web::post().to(admin::create_staff))
                    .route("/staff/{id}", web::patch().to(admin::update_staff))
                    .route(
                        "/staff/{id}/services",
                        web::put().to(admin::set_staff_services),
                    )
                    .route(
                        "/staff/{id}/working-hours",
                        web::get().to(admin::get_working_hours),
                    )
                    .route(
                        "/staff/{id}/working-hours",
                        web::put().to(admin::set_working_hours),
                    )
                    .route("/staff/{id}/time-off", web::get().to(admin::list_time_off))
                    .route("/staff/{id}/time-off", web::post().to(admin::create_time_off))
                    .route("/time-off/{id}", web::delete().to(admin::delete_time_off))
                    .route("/customers", web::get().to(admin::list_customers)),
            ),
    );
}
