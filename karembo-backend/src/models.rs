use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, Serialize, Deserialize)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Customer,
    Staff,
    Admin,
}

impl UserRole {
    pub fn is_admin(self) -> bool {
        matches!(self, Self::Admin)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, Serialize, Deserialize)]
#[sqlx(type_name = "booking_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BookingStatus {
    Pending,
    Confirmed,
    Completed,
    Cancelled,
    NoShow,
}

impl BookingStatus {
    /// Statuses that still occupy the stylist's calendar.
    pub fn is_live(self) -> bool {
        matches!(self, Self::Pending | Self::Confirmed | Self::Completed)
    }
}

/// A user row as stored. `password_hash` never leaves this struct — the API
/// serialises `UserProfile` instead.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
}

/// The client-safe projection of a user.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserProfile {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role,
            created_at: user.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Service {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub duration_min: i32,
    pub price_cents: i32,
    pub image_url: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct StaffMember {
    pub id: Uuid,
    pub display_name: String,
    pub title: String,
    pub bio: String,
    pub avatar_url: Option<String>,
    pub is_active: bool,
}

/// A stylist together with the service ids they are qualified for, so the booking
/// UI can filter without an extra round trip per stylist.
#[derive(Debug, Clone, Serialize)]
pub struct StaffWithServices {
    #[serde(flatten)]
    pub staff: StaffMember,
    pub service_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct WorkingHour {
    pub id: Uuid,
    pub staff_id: Uuid,
    /// ISO weekday: 1 = Monday .. 7 = Sunday.
    pub weekday: i16,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TimeOff {
    pub id: Uuid,
    pub staff_id: Uuid,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub reason: String,
}

/// A booking joined with the names a client needs to render it, avoiding N+1
/// lookups from the frontend.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BookingDetail {
    pub id: Uuid,
    pub reference: String,
    pub status: BookingStatus,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub price_cents: i32,
    pub notes: String,
    pub cancellation_reason: Option<String>,
    pub created_at: DateTime<Utc>,

    pub customer_id: Uuid,
    pub customer_name: String,
    pub customer_email: String,
    pub customer_phone: Option<String>,

    pub staff_id: Uuid,
    pub staff_name: String,

    pub service_id: Uuid,
    pub service_name: String,
    pub service_duration_min: i32,
}

/// One bookable start time returned by the availability endpoint.
#[derive(Debug, Clone, Serialize)]
pub struct AvailableSlot {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
}
