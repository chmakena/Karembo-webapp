use actix_web::{HttpResponse, web};
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AdminUser,
    error::{ApiError, ApiResult},
    models::{
        BookingDetail, BookingStatus, Service, StaffMember, TimeOff, UserProfile, WorkingHour,
    },
    routes::bookings::BOOKING_SELECT,
};

/// Record who performed a state-changing admin action.
///
/// Admin endpoints can rewrite other people's appointments, prices, and rotas, so
/// every mutation leaves a line naming the operator. Read-only endpoints are not
/// logged — that would be noise.
fn audit(admin: &AdminUser, action: impl std::fmt::Display) {
    log::info!(
        "admin action by {} <{}>: {action}",
        admin.0.id,
        admin.0.email
    );
}

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct Overview {
    pub bookings_today: i64,
    pub bookings_upcoming: i64,
    pub bookings_this_week: i64,
    pub cancellations_this_week: i64,
    pub revenue_this_week_cents: i64,
    pub revenue_confirmed_upcoming_cents: i64,
    pub active_services: i64,
    pub active_staff: i64,
    pub total_customers: i64,
    pub busiest_staff: Vec<StaffLoad>,
    pub popular_services: Vec<ServiceDemand>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StaffLoad {
    pub staff_id: Uuid,
    pub staff_name: String,
    pub booking_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ServiceDemand {
    pub service_id: Uuid,
    pub service_name: String,
    pub booking_count: i64,
    pub revenue_cents: i64,
}

pub async fn overview(pool: web::Data<PgPool>, _admin: AdminUser) -> ApiResult<HttpResponse> {
    // A single row of scalars keeps the dashboard to one round trip for counters.
    let counters: (i64, i64, i64, i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT
            (SELECT count(*) FROM bookings
              WHERE status IN ('pending','confirmed')
                AND starts_at::date = now()::date),
            (SELECT count(*) FROM bookings
              WHERE status IN ('pending','confirmed') AND starts_at >= now()),
            (SELECT count(*) FROM bookings
              WHERE starts_at >= date_trunc('week', now())
                AND starts_at < date_trunc('week', now()) + interval '1 week'
                AND status IN ('pending','confirmed','completed')),
            (SELECT count(*) FROM bookings
              WHERE status = 'cancelled'
                AND cancelled_at >= date_trunc('week', now())),
            (SELECT COALESCE(sum(price_cents), 0) FROM bookings
              WHERE status IN ('confirmed','completed')
                AND starts_at >= date_trunc('week', now())
                AND starts_at < date_trunc('week', now()) + interval '1 week'),
            (SELECT COALESCE(sum(price_cents), 0) FROM bookings
              WHERE status IN ('pending','confirmed') AND starts_at >= now()),
            (SELECT count(*) FROM services WHERE is_active),
            (SELECT count(*) FROM staff WHERE is_active),
            (SELECT count(*) FROM users WHERE role = 'customer')",
    )
    .fetch_one(pool.get_ref())
    .await?;

    let busiest_staff = sqlx::query_as::<_, StaffLoad>(
        "SELECT s.id AS staff_id, s.display_name AS staff_name, count(b.id) AS booking_count
         FROM staff s
         LEFT JOIN bookings b ON b.staff_id = s.id
              AND b.status IN ('pending','confirmed','completed')
              AND b.starts_at >= now() - interval '30 days'
         WHERE s.is_active
         GROUP BY s.id, s.display_name
         ORDER BY booking_count DESC, s.display_name
         LIMIT 5",
    )
    .fetch_all(pool.get_ref())
    .await?;

    let popular_services = sqlx::query_as::<_, ServiceDemand>(
        "SELECT sv.id AS service_id, sv.name AS service_name,
                count(b.id) AS booking_count,
                COALESCE(sum(b.price_cents), 0)::bigint AS revenue_cents
         FROM services sv
         LEFT JOIN bookings b ON b.service_id = sv.id
              AND b.status IN ('pending','confirmed','completed')
              AND b.starts_at >= now() - interval '30 days'
         WHERE sv.is_active
         GROUP BY sv.id, sv.name
         ORDER BY booking_count DESC, sv.name
         LIMIT 5",
    )
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(Overview {
        bookings_today: counters.0,
        bookings_upcoming: counters.1,
        bookings_this_week: counters.2,
        cancellations_this_week: counters.3,
        revenue_this_week_cents: counters.4,
        revenue_confirmed_upcoming_cents: counters.5,
        active_services: counters.6,
        active_staff: counters.7,
        total_customers: counters.8,
        busiest_staff,
        popular_services,
    }))
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AdminBookingQuery {
    pub status: Option<BookingStatus>,
    pub staff_id: Option<Uuid>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBookingStatusRequest {
    pub status: BookingStatus,
    #[serde(default)]
    pub cancellation_reason: Option<String>,
}

pub async fn list_bookings(
    pool: web::Data<PgPool>,
    _admin: AdminUser,
    query: web::Query<AdminBookingQuery>,
) -> ApiResult<HttpResponse> {
    // Filters are all bound parameters; each is skipped when NULL. This keeps one
    // prepared statement instead of concatenating user input into SQL.
    let sql = format!(
        "{BOOKING_SELECT}
         WHERE ($1::booking_status IS NULL OR b.status = $1)
           AND ($2::uuid IS NULL OR b.staff_id = $2)
           AND ($3::date IS NULL OR b.starts_at >= $3::date)
           AND ($4::date IS NULL OR b.starts_at < ($4::date + 1))
           AND ($5::text IS NULL OR (
                 u.full_name ILIKE '%' || $5 || '%'
                 OR u.email ILIKE '%' || $5 || '%'
                 OR b.reference ILIKE '%' || $5 || '%'
               ))
         ORDER BY b.starts_at DESC
         LIMIT 500"
    );

    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let bookings = sqlx::query_as::<_, BookingDetail>(sqlx::AssertSqlSafe(sql))
        .bind(query.status)
        .bind(query.staff_id)
        .bind(query.from)
        .bind(query.to)
        .bind(search)
        .fetch_all(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(bookings))
}

pub async fn update_booking_status(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<UpdateBookingStatusRequest>,
) -> ApiResult<HttpResponse> {
    let booking_id = id.into_inner();
    let body = body.into_inner();

    // Re-activating a cancelled booking has to clear the exclusion-constraint
    // exemption, which can fail if the slot was taken meanwhile — that surfaces
    // as a 409 through the sqlx error mapping.
    let updated = sqlx::query(
        "UPDATE bookings
         SET status = $2,
             cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE NULL END,
             cancellation_reason = CASE WHEN $2 = 'cancelled' THEN $3 ELSE NULL END
         WHERE id = $1",
    )
    .bind(booking_id)
    .bind(body.status)
    .bind(
        body.cancellation_reason
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .execute(pool.get_ref())
    .await?;

    if updated.rows_affected() == 0 {
        return Err(ApiError::not_found("Booking not found."));
    }

    audit(
        &admin,
        format!("set booking {booking_id} status to {:?}", body.status),
    );

    let sql = format!("{BOOKING_SELECT} WHERE b.id = $1");
    let booking = sqlx::query_as::<_, BookingDetail>(sqlx::AssertSqlSafe(sql))
        .bind(booking_id)
        .fetch_one(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(booking))
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ServiceInput {
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub description: String,
    pub category: String,
    pub duration_min: i32,
    pub price_cents: i32,
    #[serde(default)]
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ServicePatch {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub duration_min: Option<i32>,
    pub price_cents: Option<i32>,
    pub image_url: Option<String>,
    pub is_active: Option<bool>,
}

fn validate_service_shape(duration_min: i32, price_cents: i32) -> ApiResult<()> {
    if !(1..=600).contains(&duration_min) {
        return Err(ApiError::unprocessable(
            "Duration must be between 1 and 600 minutes.",
        ));
    }
    if price_cents < 0 {
        return Err(ApiError::unprocessable("Price cannot be negative."));
    }
    Ok(())
}

/// Admin listing includes inactive rows, unlike the public catalogue.
pub async fn list_all_services(
    pool: web::Data<PgPool>,
    _admin: AdminUser,
) -> ApiResult<HttpResponse> {
    let services = sqlx::query_as::<_, Service>(
        "SELECT id, slug, name, description, category, duration_min, price_cents, image_url, is_active
         FROM services ORDER BY is_active DESC, category, name",
    )
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(services))
}

pub async fn create_service(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    body: web::Json<ServiceInput>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();
    validate_service_shape(body.duration_min, body.price_cents)?;

    let slug = body.slug.trim().to_lowercase();
    if slug.is_empty() {
        return Err(ApiError::unprocessable("Slug is required."));
    }

    let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM services WHERE slug = $1")
        .bind(&slug)
        .fetch_optional(pool.get_ref())
        .await?;

    if existing.is_some() {
        return Err(ApiError::conflict("A service with that slug already exists."));
    }

    let service = sqlx::query_as::<_, Service>(
        "INSERT INTO services (slug, name, description, category, duration_min, price_cents, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, slug, name, description, category, duration_min, price_cents, image_url, is_active",
    )
    .bind(&slug)
    .bind(body.name.trim())
    .bind(body.description.trim())
    .bind(body.category.trim())
    .bind(body.duration_min)
    .bind(body.price_cents)
    .bind(body.image_url.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .fetch_one(pool.get_ref())
    .await?;

    audit(&admin, format!("created service \"{}\"", service.name));

    Ok(HttpResponse::Created().json(service))
}

pub async fn update_service(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<ServicePatch>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();

    if let (Some(duration), Some(price)) = (body.duration_min, body.price_cents) {
        validate_service_shape(duration, price)?;
    } else {
        if let Some(duration) = body.duration_min {
            validate_service_shape(duration, 0)?;
        }
        if let Some(price) = body.price_cents {
            validate_service_shape(1, price)?;
        }
    }

    let service = sqlx::query_as::<_, Service>(
        "UPDATE services SET
            name         = COALESCE($2, name),
            description  = COALESCE($3, description),
            category     = COALESCE($4, category),
            duration_min = COALESCE($5, duration_min),
            price_cents  = COALESCE($6, price_cents),
            image_url    = CASE WHEN $7::boolean THEN $8 ELSE image_url END,
            is_active    = COALESCE($9, is_active)
         WHERE id = $1
         RETURNING id, slug, name, description, category, duration_min, price_cents, image_url, is_active",
    )
    .bind(id.into_inner())
    .bind(body.name.as_deref().map(str::trim))
    .bind(body.description.as_deref())
    .bind(body.category.as_deref().map(str::trim))
    .bind(body.duration_min)
    .bind(body.price_cents)
    .bind(body.image_url.is_some())
    .bind(body.image_url.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .bind(body.is_active)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("Service not found."))?;

    audit(&admin, format!("updated service {}", service.id));

    Ok(HttpResponse::Ok().json(service))
}

/// Retire a service rather than deleting it, so historical bookings keep their
/// service name and the FK stays intact.
pub async fn retire_service(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
) -> ApiResult<HttpResponse> {
    let service_id = id.into_inner();

    let updated = sqlx::query("UPDATE services SET is_active = false WHERE id = $1")
        .bind(service_id)
        .execute(pool.get_ref())
        .await?;

    if updated.rows_affected() == 0 {
        return Err(ApiError::not_found("Service not found."));
    }

    audit(&admin, format!("retired service {service_id}"));

    Ok(HttpResponse::NoContent().finish())
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct StaffInput {
    pub display_name: String,
    #[serde(default = "default_title")]
    pub title: String,
    #[serde(default)]
    pub bio: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

fn default_title() -> String {
    "Stylist".to_string()
}

#[derive(Debug, Deserialize)]
pub struct StaffPatch {
    pub display_name: Option<String>,
    pub title: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct StaffServicesInput {
    pub service_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ShiftInput {
    /// ISO weekday: 1 = Monday .. 7 = Sunday.
    pub weekday: i16,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
}

#[derive(Debug, Deserialize)]
pub struct WorkingHoursInput {
    pub shifts: Vec<ShiftInput>,
}

#[derive(Debug, Deserialize)]
pub struct TimeOffInput {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    #[serde(default)]
    pub reason: String,
}

pub async fn list_all_staff(pool: web::Data<PgPool>, _admin: AdminUser) -> ApiResult<HttpResponse> {
    let staff = sqlx::query_as::<_, StaffMember>(
        "SELECT id, display_name, title, bio, avatar_url, is_active
         FROM staff ORDER BY is_active DESC, display_name",
    )
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(staff))
}

pub async fn create_staff(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    body: web::Json<StaffInput>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();
    let display_name = body.display_name.trim();

    if display_name.len() < 2 {
        return Err(ApiError::unprocessable("Enter the stylist's name."));
    }

    let staff = sqlx::query_as::<_, StaffMember>(
        "INSERT INTO staff (display_name, title, bio, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, display_name, title, bio, avatar_url, is_active",
    )
    .bind(display_name)
    .bind(body.title.trim())
    .bind(body.bio.trim())
    .bind(body.avatar_url.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .fetch_one(pool.get_ref())
    .await?;

    audit(&admin, format!("added stylist \"{}\"", staff.display_name));

    Ok(HttpResponse::Created().json(staff))
}

pub async fn update_staff(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<StaffPatch>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();

    let staff = sqlx::query_as::<_, StaffMember>(
        "UPDATE staff SET
            display_name = COALESCE($2, display_name),
            title        = COALESCE($3, title),
            bio          = COALESCE($4, bio),
            avatar_url   = CASE WHEN $5::boolean THEN $6 ELSE avatar_url END,
            is_active    = COALESCE($7, is_active)
         WHERE id = $1
         RETURNING id, display_name, title, bio, avatar_url, is_active",
    )
    .bind(id.into_inner())
    .bind(body.display_name.as_deref().map(str::trim))
    .bind(body.title.as_deref().map(str::trim))
    .bind(body.bio.as_deref())
    .bind(body.avatar_url.is_some())
    .bind(body.avatar_url.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .bind(body.is_active)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("Stylist not found."))?;

    audit(&admin, format!("updated stylist {}", staff.id));

    Ok(HttpResponse::Ok().json(staff))
}

/// Replace a stylist's service coverage wholesale. Doing this in a transaction
/// avoids a window where the stylist appears to offer nothing.
pub async fn set_staff_services(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<StaffServicesInput>,
) -> ApiResult<HttpResponse> {
    let staff_id = id.into_inner();
    let service_ids = body.into_inner().service_ids;

    let mut tx = pool.begin().await?;

    let exists: (bool,) = sqlx::query_as("SELECT EXISTS (SELECT 1 FROM staff WHERE id = $1)")
        .bind(staff_id)
        .fetch_one(&mut *tx)
        .await?;

    if !exists.0 {
        return Err(ApiError::not_found("Stylist not found."));
    }

    sqlx::query("DELETE FROM staff_services WHERE staff_id = $1")
        .bind(staff_id)
        .execute(&mut *tx)
        .await?;

    if !service_ids.is_empty() {
        // unnest lets one statement insert the whole set; the FK rejects unknown ids.
        sqlx::query(
            "INSERT INTO staff_services (staff_id, service_id)
             SELECT $1, unnest($2::uuid[])",
        )
        .bind(staff_id)
        .bind(&service_ids)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    audit(
        &admin,
        format!(
            "set {} service(s) for stylist {staff_id}",
            service_ids.len()
        ),
    );

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "staff_id": staff_id,
        "service_ids": service_ids,
    })))
}

pub async fn get_working_hours(
    pool: web::Data<PgPool>,
    _admin: AdminUser,
    id: web::Path<Uuid>,
) -> ApiResult<HttpResponse> {
    let hours = sqlx::query_as::<_, WorkingHour>(
        "SELECT id, staff_id, weekday, start_time, end_time
         FROM working_hours WHERE staff_id = $1
         ORDER BY weekday, start_time",
    )
    .bind(id.into_inner())
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(hours))
}

/// Replace a stylist's weekly rota.
///
/// Existing bookings are deliberately left alone: removing a shift does not
/// cancel appointments already inside it. Those stay visible in the admin
/// calendar so a human can decide what to do.
pub async fn set_working_hours(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<WorkingHoursInput>,
) -> ApiResult<HttpResponse> {
    let staff_id = id.into_inner();
    let shifts = body.into_inner().shifts;

    for shift in &shifts {
        if !(1..=7).contains(&shift.weekday) {
            return Err(ApiError::unprocessable(
                "Weekday must be 1 (Monday) through 7 (Sunday).",
            ));
        }
        if shift.start_time >= shift.end_time {
            return Err(ApiError::unprocessable(
                "A shift must end after it starts.",
            ));
        }
    }

    // Overlapping shifts on the same weekday would generate duplicate slots.
    for (index, shift) in shifts.iter().enumerate() {
        for other in shifts.iter().skip(index + 1) {
            if shift.weekday == other.weekday
                && shift.start_time < other.end_time
                && other.start_time < shift.end_time
            {
                return Err(ApiError::unprocessable(
                    "Two shifts on the same day cannot overlap.",
                ));
            }
        }
    }

    let mut tx = pool.begin().await?;

    let exists: (bool,) = sqlx::query_as("SELECT EXISTS (SELECT 1 FROM staff WHERE id = $1)")
        .bind(staff_id)
        .fetch_one(&mut *tx)
        .await?;

    if !exists.0 {
        return Err(ApiError::not_found("Stylist not found."));
    }

    sqlx::query("DELETE FROM working_hours WHERE staff_id = $1")
        .bind(staff_id)
        .execute(&mut *tx)
        .await?;

    for shift in &shifts {
        sqlx::query(
            "INSERT INTO working_hours (staff_id, weekday, start_time, end_time)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(staff_id)
        .bind(shift.weekday)
        .bind(shift.start_time)
        .bind(shift.end_time)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    audit(
        &admin,
        format!("set {} shift(s) for stylist {staff_id}", shifts.len()),
    );

    let hours = sqlx::query_as::<_, WorkingHour>(
        "SELECT id, staff_id, weekday, start_time, end_time
         FROM working_hours WHERE staff_id = $1 ORDER BY weekday, start_time",
    )
    .bind(staff_id)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(hours))
}

pub async fn list_time_off(
    pool: web::Data<PgPool>,
    _admin: AdminUser,
    id: web::Path<Uuid>,
) -> ApiResult<HttpResponse> {
    let entries = sqlx::query_as::<_, TimeOff>(
        "SELECT id, staff_id, starts_at, ends_at, reason
         FROM time_off WHERE staff_id = $1 AND ends_at >= now() - interval '30 days'
         ORDER BY starts_at",
    )
    .bind(id.into_inner())
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(entries))
}

pub async fn create_time_off(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
    body: web::Json<TimeOffInput>,
) -> ApiResult<HttpResponse> {
    let staff_id = id.into_inner();
    let body = body.into_inner();

    if body.starts_at >= body.ends_at {
        return Err(ApiError::unprocessable("Time off must end after it starts."));
    }

    // Warn rather than silently strand customers: an admin booking leave over
    // existing appointments needs to know they are still on the calendar.
    let clashing: (i64,) = sqlx::query_as(
        "SELECT count(*) FROM bookings
         WHERE staff_id = $1 AND status IN ('pending','confirmed')
           AND starts_at < $3 AND ends_at > $2",
    )
    .bind(staff_id)
    .bind(body.starts_at)
    .bind(body.ends_at)
    .fetch_one(pool.get_ref())
    .await?;

    let entry = sqlx::query_as::<_, TimeOff>(
        "INSERT INTO time_off (staff_id, starts_at, ends_at, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id, staff_id, starts_at, ends_at, reason",
    )
    .bind(staff_id)
    .bind(body.starts_at)
    .bind(body.ends_at)
    .bind(body.reason.trim())
    .fetch_one(pool.get_ref())
    .await?;

    audit(
        &admin,
        format!(
            "booked time off for stylist {staff_id} ({} clashing booking(s))",
            clashing.0
        ),
    );

    Ok(HttpResponse::Created().json(serde_json::json!({
        "time_off": entry,
        "clashing_bookings": clashing.0,
    })))
}

pub async fn delete_time_off(
    pool: web::Data<PgPool>,
    admin: AdminUser,
    id: web::Path<Uuid>,
) -> ApiResult<HttpResponse> {
    let entry_id = id.into_inner();

    let deleted = sqlx::query("DELETE FROM time_off WHERE id = $1")
        .bind(entry_id)
        .execute(pool.get_ref())
        .await?;

    if deleted.rows_affected() == 0 {
        return Err(ApiError::not_found("Time-off entry not found."));
    }

    audit(&admin, format!("deleted time-off entry {entry_id}"));

    Ok(HttpResponse::NoContent().finish())
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CustomerQuery {
    pub search: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CustomerSummary {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub profile: UserProfile,
    pub booking_count: i64,
    pub last_visit: Option<DateTime<Utc>>,
}

pub async fn list_customers(
    pool: web::Data<PgPool>,
    _admin: AdminUser,
    query: web::Query<CustomerQuery>,
) -> ApiResult<HttpResponse> {
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let customers = sqlx::query_as::<_, CustomerSummary>(
        "SELECT u.id, u.email, u.full_name, u.phone, u.role, u.created_at,
                count(b.id) AS booking_count,
                max(b.starts_at) FILTER (WHERE b.status = 'completed') AS last_visit
         FROM users u
         LEFT JOIN bookings b ON b.customer_id = u.id
         WHERE u.role = 'customer'
           AND ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
         GROUP BY u.id, u.email, u.full_name, u.phone, u.role, u.created_at
         ORDER BY u.full_name
         LIMIT 500",
    )
    .bind(search)
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(customers))
}
