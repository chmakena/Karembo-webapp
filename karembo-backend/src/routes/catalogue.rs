use actix_web::{HttpResponse, web};
use chrono::{Duration, FixedOffset, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    availability::{BusyInterval, Shift, SlotQuery, compute_slots, day_window, iso_weekday},
    config::Config,
    error::{ApiError, ApiResult},
    models::{AvailableSlot, Service, StaffMember, StaffWithServices, WorkingHour},
};

#[derive(Debug, Deserialize)]
pub struct ServiceFilter {
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StaffFilter {
    /// Restrict to stylists qualified for this service.
    pub service_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AvailabilityQuery {
    pub staff_id: Uuid,
    pub service_id: Uuid,
    /// Salon-local calendar date, `YYYY-MM-DD`.
    pub date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct AvailabilityRangeQuery {
    pub staff_id: Uuid,
    pub service_id: Uuid,
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct AvailabilityResponse {
    pub date: NaiveDate,
    pub staff_id: Uuid,
    pub service_id: Uuid,
    pub slots: Vec<AvailableSlot>,
}

#[derive(Debug, Serialize)]
pub struct DayAvailability {
    pub date: NaiveDate,
    pub slot_count: usize,
    pub first_slot: Option<AvailableSlot>,
}

pub async fn list_services(
    pool: web::Data<PgPool>,
    filter: web::Query<ServiceFilter>,
) -> ApiResult<HttpResponse> {
    let services = sqlx::query_as::<_, Service>(
        "SELECT id, slug, name, description, category, duration_min, price_cents, image_url, is_active
         FROM services
         WHERE is_active AND ($1::text IS NULL OR category = $1)
         ORDER BY category, name",
    )
    .bind(filter.category.as_deref())
    .fetch_all(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(services))
}

pub async fn list_categories(pool: web::Data<PgPool>) -> ApiResult<HttpResponse> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT category, count(*) FROM services WHERE is_active GROUP BY category ORDER BY category",
    )
    .fetch_all(pool.get_ref())
    .await?;

    #[derive(Serialize)]
    struct Category {
        name: String,
        service_count: i64,
    }

    let categories: Vec<Category> = rows
        .into_iter()
        .map(|(name, service_count)| Category {
            name,
            service_count,
        })
        .collect();

    Ok(HttpResponse::Ok().json(categories))
}

pub async fn get_service(
    pool: web::Data<PgPool>,
    slug: web::Path<String>,
) -> ApiResult<HttpResponse> {
    let service = sqlx::query_as::<_, Service>(
        "SELECT id, slug, name, description, category, duration_min, price_cents, image_url, is_active
         FROM services WHERE slug = $1 AND is_active",
    )
    .bind(slug.as_str())
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or_else(|| ApiError::not_found("That service is not available."))?;

    Ok(HttpResponse::Ok().json(service))
}

pub async fn list_staff(
    pool: web::Data<PgPool>,
    filter: web::Query<StaffFilter>,
) -> ApiResult<HttpResponse> {
    let staff = sqlx::query_as::<_, StaffMember>(
        "SELECT s.id, s.display_name, s.title, s.bio, s.avatar_url, s.is_active
         FROM staff s
         WHERE s.is_active
           AND ($1::uuid IS NULL OR EXISTS (
                 SELECT 1 FROM staff_services ss
                 WHERE ss.staff_id = s.id AND ss.service_id = $1
               ))
         ORDER BY s.display_name",
    )
    .bind(filter.service_id)
    .fetch_all(pool.get_ref())
    .await?;

    // One extra query for all coverage rows, rather than one per stylist.
    let coverage: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT ss.staff_id, ss.service_id
         FROM staff_services ss
         JOIN staff s ON s.id = ss.staff_id
         JOIN services sv ON sv.id = ss.service_id
         WHERE s.is_active AND sv.is_active",
    )
    .fetch_all(pool.get_ref())
    .await?;

    let enriched: Vec<StaffWithServices> = staff
        .into_iter()
        .map(|member| {
            let service_ids = coverage
                .iter()
                .filter(|(staff_id, _)| *staff_id == member.id)
                .map(|(_, service_id)| *service_id)
                .collect();
            StaffWithServices {
                staff: member,
                service_ids,
            }
        })
        .collect();

    Ok(HttpResponse::Ok().json(enriched))
}

/// Everything the slot generator needs for one stylist on one day.
struct DayInputs {
    shifts: Vec<Shift>,
    busy: Vec<BusyInterval>,
}

/// Confirm the stylist exists, is active, and can perform the service; return the
/// service's duration.
async fn resolve_duration(
    pool: &PgPool,
    staff_id: Uuid,
    service_id: Uuid,
) -> ApiResult<i64> {
    let row: Option<(i32,)> = sqlx::query_as(
        "SELECT sv.duration_min
         FROM services sv
         JOIN staff_services ss ON ss.service_id = sv.id
         JOIN staff s ON s.id = ss.staff_id
         WHERE sv.id = $1 AND s.id = $2 AND sv.is_active AND s.is_active",
    )
    .bind(service_id)
    .bind(staff_id)
    .fetch_optional(pool)
    .await?;

    row.map(|(duration,)| duration as i64).ok_or_else(|| {
        ApiError::unprocessable("That stylist does not offer the selected service.")
    })
}

async fn load_day_inputs(
    pool: &PgPool,
    staff_id: Uuid,
    date: NaiveDate,
    offset: FixedOffset,
) -> ApiResult<DayInputs> {
    let weekday = iso_weekday(date);
    let (window_start, window_end) = day_window(date, offset);

    let hours = sqlx::query_as::<_, WorkingHour>(
        "SELECT id, staff_id, weekday, start_time, end_time
         FROM working_hours
         WHERE staff_id = $1 AND weekday = $2
         ORDER BY start_time",
    )
    .bind(staff_id)
    .bind(weekday)
    .fetch_all(pool)
    .await?;

    // Live bookings and time off both block the calendar, so they are unioned into
    // a single busy list in one round trip.
    let busy_rows: Vec<(chrono::DateTime<Utc>, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT starts_at, ends_at FROM bookings
         WHERE staff_id = $1
           AND status IN ('pending', 'confirmed', 'completed')
           AND starts_at < $3 AND ends_at > $2
         UNION ALL
         SELECT starts_at, ends_at FROM time_off
         WHERE staff_id = $1
           AND starts_at < $3 AND ends_at > $2",
    )
    .bind(staff_id)
    .bind(window_start)
    .bind(window_end)
    .fetch_all(pool)
    .await?;

    Ok(DayInputs {
        shifts: hours
            .into_iter()
            .map(|hour| Shift {
                start: hour.start_time,
                end: hour.end_time,
            })
            .collect(),
        busy: busy_rows
            .into_iter()
            .map(|(start, end)| BusyInterval::new(start, end))
            .collect(),
    })
}

fn salon_offset(config: &Config) -> ApiResult<FixedOffset> {
    FixedOffset::east_opt(config.utc_offset_hours * 3600).ok_or_else(|| {
        log::error!(
            "SALON_UTC_OFFSET_HOURS={} is out of range",
            config.utc_offset_hours
        );
        ApiError::Internal
    })
}

/// Reject dates outside the bookable window so the endpoint cannot be used to
/// walk the calendar indefinitely.
fn check_horizon(config: &Config, date: NaiveDate, offset: FixedOffset) -> ApiResult<()> {
    let today = Utc::now().with_timezone(&offset).date_naive();

    if date < today {
        return Err(ApiError::unprocessable("That date is in the past."));
    }
    if date > today + Duration::days(config.booking_horizon_days) {
        return Err(ApiError::unprocessable(format!(
            "Bookings open {} days ahead.",
            config.booking_horizon_days
        )));
    }
    Ok(())
}

pub async fn availability(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    query: web::Query<AvailabilityQuery>,
) -> ApiResult<HttpResponse> {
    let offset = salon_offset(&config)?;
    check_horizon(&config, query.date, offset)?;

    let duration = resolve_duration(pool.get_ref(), query.staff_id, query.service_id).await?;
    let inputs = load_day_inputs(pool.get_ref(), query.staff_id, query.date, offset).await?;

    let slots = compute_slots(&SlotQuery {
        date: query.date,
        offset,
        service_duration_min: duration,
        shifts: &inputs.shifts,
        busy: &inputs.busy,
        now: Utc::now(),
        lead_minutes: config.booking_lead_minutes,
        step_minutes: config.slot_step_minutes,
    });

    Ok(HttpResponse::Ok().json(AvailabilityResponse {
        date: query.date,
        staff_id: query.staff_id,
        service_id: query.service_id,
        slots,
    }))
}

/// Per-day slot counts across a range, so the booking calendar can grey out full
/// or closed days before the customer clicks into one.
pub async fn availability_range(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    query: web::Query<AvailabilityRangeQuery>,
) -> ApiResult<HttpResponse> {
    let offset = salon_offset(&config)?;

    if query.to < query.from {
        return Err(ApiError::bad_request("`to` must not precede `from`."));
    }

    // Cap the span so one request cannot fan out into hundreds of day queries.
    let span_days = (query.to - query.from).num_days();
    if span_days > 62 {
        return Err(ApiError::bad_request(
            "Request at most 62 days of availability at a time.",
        ));
    }

    let duration = resolve_duration(pool.get_ref(), query.staff_id, query.service_id).await?;
    let now = Utc::now();
    let today = now.with_timezone(&offset).date_naive();
    let horizon = today + Duration::days(config.booking_horizon_days);

    let mut days = Vec::new();
    let mut cursor = query.from;

    while cursor <= query.to {
        if cursor < today || cursor > horizon {
            days.push(DayAvailability {
                date: cursor,
                slot_count: 0,
                first_slot: None,
            });
            cursor += Duration::days(1);
            continue;
        }

        let inputs = load_day_inputs(pool.get_ref(), query.staff_id, cursor, offset).await?;
        let slots = compute_slots(&SlotQuery {
            date: cursor,
            offset,
            service_duration_min: duration,
            shifts: &inputs.shifts,
            busy: &inputs.busy,
            now,
            lead_minutes: config.booking_lead_minutes,
            step_minutes: config.slot_step_minutes,
        });

        days.push(DayAvailability {
            date: cursor,
            slot_count: slots.len(),
            first_slot: slots.first().cloned(),
        });

        cursor += Duration::days(1);
    }

    Ok(HttpResponse::Ok().json(days))
}
