use actix_web::{HttpResponse, web};
use chrono::{DateTime, Duration, FixedOffset, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    config::Config,
    error::{ApiError, ApiResult},
    models::{BookingDetail, BookingStatus},
};

/// Shared projection so every booking response carries the same fields.
pub const BOOKING_SELECT: &str = "SELECT b.id, b.reference, b.status, b.starts_at, b.ends_at,
        b.price_cents, b.notes, b.cancellation_reason, b.created_at,
        b.customer_id, u.full_name AS customer_name, u.email AS customer_email,
        u.phone AS customer_phone,
        b.staff_id, s.display_name AS staff_name,
        b.service_id, sv.name AS service_name, sv.duration_min AS service_duration_min
 FROM bookings b
 JOIN users u ON u.id = b.customer_id
 JOIN staff s ON s.id = b.staff_id
 JOIN services sv ON sv.id = b.service_id";

#[derive(Debug, Deserialize)]
pub struct CreateBookingRequest {
    pub staff_id: Uuid,
    pub service_id: Uuid,
    /// Slot start as returned by the availability endpoint (RFC 3339).
    pub starts_at: DateTime<Utc>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RescheduleRequest {
    pub starts_at: DateTime<Utc>,
    /// Optionally move to a different stylist at the same time.
    #[serde(default)]
    pub staff_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BookingListQuery {
    /// `upcoming` (default) or `past`, filtering on the appointment time.
    #[serde(default)]
    pub window: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BookingListResponse {
    pub bookings: Vec<BookingDetail>,
}

fn salon_offset(config: &Config) -> ApiResult<FixedOffset> {
    FixedOffset::east_opt(config.utc_offset_hours * 3600).ok_or(ApiError::Internal)
}

fn clean_notes(notes: Option<String>) -> ApiResult<String> {
    let notes = notes.unwrap_or_default().trim().to_string();
    if notes.chars().count() > 1000 {
        return Err(ApiError::unprocessable(
            "Notes must be 1000 characters or fewer.",
        ));
    }
    Ok(notes)
}

/// Details of the service being booked, plus confirmation the stylist offers it.
struct BookableService {
    duration_min: i64,
    price_cents: i32,
}

async fn resolve_bookable(
    pool: &PgPool,
    staff_id: Uuid,
    service_id: Uuid,
) -> ApiResult<BookableService> {
    let row: Option<(i32, i32)> = sqlx::query_as(
        "SELECT sv.duration_min, sv.price_cents
         FROM services sv
         JOIN staff_services ss ON ss.service_id = sv.id
         JOIN staff s ON s.id = ss.staff_id
         WHERE sv.id = $1 AND s.id = $2 AND sv.is_active AND s.is_active",
    )
    .bind(service_id)
    .bind(staff_id)
    .fetch_optional(pool)
    .await?;

    row.map(|(duration_min, price_cents)| BookableService {
        duration_min: duration_min as i64,
        price_cents,
    })
    .ok_or_else(|| ApiError::unprocessable("That stylist does not offer the selected service."))
}

/// Validate a requested start time against lead time, horizon, and slot grid.
///
/// This is a fast pre-check for clear feedback. It is *not* what guarantees
/// correctness: the stylist's working hours and the absence of a clash are
/// enforced below by a re-check inside the transaction plus the database's
/// exclusion constraint.
fn validate_start_time(
    config: &Config,
    offset: FixedOffset,
    starts_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> ApiResult<()> {
    if starts_at < now + Duration::minutes(config.booking_lead_minutes) {
        return Err(ApiError::unprocessable(format!(
            "Bookings need at least {} minutes' notice.",
            config.booking_lead_minutes
        )));
    }

    let local_date = starts_at.with_timezone(&offset).date_naive();
    let today = now.with_timezone(&offset).date_naive();

    if local_date > today + Duration::days(config.booking_horizon_days) {
        return Err(ApiError::unprocessable(format!(
            "Bookings open {} days ahead.",
            config.booking_horizon_days
        )));
    }

    // Reject off-grid times so the stored calendar stays aligned to the slots
    // customers are actually shown.
    let step = config.slot_step_minutes;
    if step > 0 {
        let minutes_into_hour = starts_at.with_timezone(&offset).time();
        let total_minutes = minutes_into_hour.signed_duration_since(chrono::NaiveTime::MIN);
        if total_minutes.num_seconds() % (step * 60) != 0 {
            return Err(ApiError::unprocessable(format!(
                "Appointments start on {step}-minute boundaries."
            )));
        }
    }

    Ok(())
}

/// Confirm the requested window sits wholly inside one of the stylist's shifts
/// and clashes with no time off. Runs inside the booking transaction.
async fn assert_within_shift(
    executor: &mut sqlx::PgConnection,
    staff_id: Uuid,
    starts_at: DateTime<Utc>,
    ends_at: DateTime<Utc>,
    offset: FixedOffset,
) -> ApiResult<()> {
    let local_start = starts_at.with_timezone(&offset);
    let local_end = ends_at.with_timezone(&offset);

    // An appointment may not span midnight, since shifts are defined per weekday.
    if local_start.date_naive() != local_end.date_naive()
        && local_end.time() != chrono::NaiveTime::MIN
    {
        return Err(ApiError::unprocessable(
            "Appointments cannot run past closing time.",
        ));
    }

    let weekday = crate::availability::iso_weekday(local_start.date_naive());

    let fits: (bool,) = sqlx::query_as(
        "SELECT EXISTS (
             SELECT 1 FROM working_hours
             WHERE staff_id = $1 AND weekday = $2
               AND start_time <= $3 AND end_time >= $4
         )",
    )
    .bind(staff_id)
    .bind(weekday)
    .bind(local_start.time())
    .bind(local_end.time())
    .fetch_one(&mut *executor)
    .await?;

    if !fits.0 {
        return Err(ApiError::unprocessable(
            "That stylist is not working at the requested time.",
        ));
    }

    let on_leave: (bool,) = sqlx::query_as(
        "SELECT EXISTS (
             SELECT 1 FROM time_off
             WHERE staff_id = $1 AND starts_at < $3 AND ends_at > $2
         )",
    )
    .bind(staff_id)
    .bind(starts_at)
    .bind(ends_at)
    .fetch_one(&mut *executor)
    .await?;

    if on_leave.0 {
        return Err(ApiError::unprocessable(
            "That stylist is away at the requested time.",
        ));
    }

    Ok(())
}

pub async fn create_booking(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    caller: AuthUser,
    body: web::Json<CreateBookingRequest>,
) -> ApiResult<HttpResponse> {
    let body = body.into_inner();
    let offset = salon_offset(&config)?;
    let now = Utc::now();

    validate_start_time(&config, offset, body.starts_at, now)?;
    let notes = clean_notes(body.notes)?;

    let bookable = resolve_bookable(pool.get_ref(), body.staff_id, body.service_id).await?;
    let ends_at = body.starts_at + Duration::minutes(bookable.duration_min);

    let mut tx = pool.begin().await?;

    assert_within_shift(&mut tx, body.staff_id, body.starts_at, ends_at, offset).await?;

    // The INSERT is the real gatekeeper: `bookings_no_staff_overlap` rejects any
    // clash atomically, so two customers racing for the same slot cannot both win.
    // The loser's error is mapped to 409 in `ApiError::from(sqlx::Error)`.
    let created = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO bookings
             (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents, notes)
         VALUES
             ('KMB-' || upper(encode(gen_random_bytes(5), 'hex')), $1, $2, $3, $4, $5, $6, $7)
         RETURNING id",
    )
    .bind(caller.id)
    .bind(body.staff_id)
    .bind(body.service_id)
    .bind(body.starts_at)
    .bind(ends_at)
    .bind(bookable.price_cents)
    .bind(&notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let booking = fetch_booking(pool.get_ref(), created.0).await?;
    Ok(HttpResponse::Created().json(booking))
}

pub async fn list_my_bookings(
    pool: web::Data<PgPool>,
    caller: AuthUser,
    query: web::Query<BookingListQuery>,
) -> ApiResult<HttpResponse> {
    let past = query.window.as_deref() == Some("past");

    // Upcoming appointments read best soonest-first; history reads best newest-first.
    let sql = if past {
        format!("{BOOKING_SELECT} WHERE b.customer_id = $1 AND b.starts_at < now() ORDER BY b.starts_at DESC")
    } else {
        format!("{BOOKING_SELECT} WHERE b.customer_id = $1 AND b.starts_at >= now() ORDER BY b.starts_at ASC")
    };

    let bookings = sqlx::query_as::<_, BookingDetail>(sqlx::AssertSqlSafe(sql))
        .bind(caller.id)
        .fetch_all(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(BookingListResponse { bookings }))
}

async fn fetch_booking(pool: &PgPool, id: Uuid) -> ApiResult<BookingDetail> {
    let sql = format!("{BOOKING_SELECT} WHERE b.id = $1");

    sqlx::query_as::<_, BookingDetail>(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Booking not found."))
}

pub async fn get_booking(
    pool: web::Data<PgPool>,
    caller: AuthUser,
    id: web::Path<Uuid>,
) -> ApiResult<HttpResponse> {
    let booking = fetch_booking(pool.get_ref(), id.into_inner()).await?;
    caller.require_self_or_admin(booking.customer_id)?;
    Ok(HttpResponse::Ok().json(booking))
}

pub async fn cancel_booking(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    caller: AuthUser,
    id: web::Path<Uuid>,
    body: Option<web::Json<CancelRequest>>,
) -> ApiResult<HttpResponse> {
    let booking_id = id.into_inner();
    let booking = fetch_booking(pool.get_ref(), booking_id).await?;
    caller.require_self_or_admin(booking.customer_id)?;

    match booking.status {
        BookingStatus::Cancelled => {
            return Err(ApiError::conflict("That booking is already cancelled."));
        }
        BookingStatus::Completed => {
            return Err(ApiError::conflict(
                "A completed appointment cannot be cancelled.",
            ));
        }
        BookingStatus::NoShow => {
            return Err(ApiError::conflict(
                "That booking is closed and cannot be cancelled.",
            ));
        }
        BookingStatus::Pending | BookingStatus::Confirmed => {}
    }

    // Customers must respect the cancellation cut-off; admins can always override,
    // since they handle phone calls and exceptions.
    if !caller.role.is_admin() {
        let cutoff = Utc::now() + Duration::hours(config.cancellation_cutoff_hours);
        if booking.starts_at < cutoff {
            return Err(ApiError::unprocessable(format!(
                "Appointments can only be cancelled more than {} hours in advance. Please call the salon.",
                config.cancellation_cutoff_hours
            )));
        }
    }

    let reason = body
        .and_then(|b| b.into_inner().reason)
        .map(|r| r.trim().to_string())
        .filter(|r| !r.is_empty());

    sqlx::query(
        "UPDATE bookings
         SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $2
         WHERE id = $1",
    )
    .bind(booking_id)
    .bind(reason)
    .execute(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(fetch_booking(pool.get_ref(), booking_id).await?))
}

pub async fn reschedule_booking(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    caller: AuthUser,
    id: web::Path<Uuid>,
    body: web::Json<RescheduleRequest>,
) -> ApiResult<HttpResponse> {
    let booking_id = id.into_inner();
    let body = body.into_inner();
    let offset = salon_offset(&config)?;
    let now = Utc::now();

    let booking = fetch_booking(pool.get_ref(), booking_id).await?;
    caller.require_self_or_admin(booking.customer_id)?;

    if !booking.status.is_live() || booking.status == BookingStatus::Completed {
        return Err(ApiError::conflict(
            "Only an active booking can be rescheduled.",
        ));
    }

    validate_start_time(&config, offset, body.starts_at, now)?;

    let staff_id = body.staff_id.unwrap_or(booking.staff_id);
    let bookable = resolve_bookable(pool.get_ref(), staff_id, booking.service_id).await?;
    let ends_at = body.starts_at + Duration::minutes(bookable.duration_min);

    let mut tx = pool.begin().await?;

    assert_within_shift(&mut tx, staff_id, body.starts_at, ends_at, offset).await?;

    // Updating the row is subject to the same exclusion constraint as an insert,
    // and the row's own current window is excluded from the comparison by virtue
    // of being replaced in the same statement.
    sqlx::query(
        "UPDATE bookings
         SET staff_id = $2, starts_at = $3, ends_at = $4
         WHERE id = $1",
    )
    .bind(booking_id)
    .bind(staff_id)
    .bind(body.starts_at)
    .bind(ends_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(HttpResponse::Ok().json(fetch_booking(pool.get_ref(), booking_id).await?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn config() -> Config {
        Config {
            database_url: "postgres://unused".into(),
            bind_address: "127.0.0.1:0".into(),
            jwt_secret: "a-test-secret-that-is-long-enough-32".into(),
            jwt_ttl_hours: 24,
            allowed_origins: vec![],
            utc_offset_hours: 3,
            booking_lead_minutes: 60,
            booking_horizon_days: 60,
            slot_step_minutes: 15,
            cancellation_cutoff_hours: 12,
        }
    }

    fn offset() -> FixedOffset {
        FixedOffset::east_opt(3 * 3600).unwrap()
    }

    /// 2026-09-08 09:00 EAT == 06:00 UTC.
    fn utc(hour: u32, minute: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 9, 8, hour, minute, 0).unwrap()
    }

    #[test]
    fn rejects_a_start_time_inside_the_lead_window() {
        let now = utc(6, 0);
        let err = validate_start_time(&config(), offset(), utc(6, 30), now);
        assert!(err.is_err(), "30 minutes' notice is under the 60-minute rule");
    }

    #[test]
    fn accepts_a_start_time_beyond_the_lead_window() {
        let now = utc(6, 0);
        assert!(validate_start_time(&config(), offset(), utc(7, 30), now).is_ok());
    }

    #[test]
    fn rejects_a_start_time_beyond_the_horizon() {
        let now = utc(6, 0);
        let far = now + Duration::days(90);
        assert!(validate_start_time(&config(), offset(), far, now).is_err());
    }

    #[test]
    fn rejects_off_grid_start_times() {
        let now = utc(6, 0);
        // 07:07 UTC is 10:07 local — not on a 15-minute boundary.
        assert!(validate_start_time(&config(), offset(), utc(7, 7), now).is_err());
        // 07:15 UTC is 10:15 local — on the grid.
        assert!(validate_start_time(&config(), offset(), utc(7, 15), now).is_ok());
    }

    #[test]
    fn notes_are_trimmed_and_length_capped() {
        assert_eq!(clean_notes(Some("  allergic to X  ".into())).unwrap(), "allergic to X");
        assert_eq!(clean_notes(None).unwrap(), "");
        assert!(clean_notes(Some("x".repeat(1001))).is_err());
    }
}
