/** Shapes returned by the Karembo API. Mirrors `karembo-backend/src/models.rs`. */

export type UserRole = "customer" | "staff" | "admin";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface Session {
  token: string;
  /** Unix seconds. */
  expires_at: number;
  user: UserProfile;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  duration_min: number;
  /** Minor units of KES — 250000 renders as "Ksh 2,500". */
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
}

export interface Category {
  name: string;
  service_count: number;
}

export interface StaffMember {
  id: string;
  display_name: string;
  title: string;
  bio: string;
  avatar_url: string | null;
  is_active: boolean;
  /** Present on the public `/staff` listing. */
  service_ids?: string[];
}

export interface AvailableSlot {
  starts_at: string;
  ends_at: string;
}

export interface AvailabilityResponse {
  date: string;
  staff_id: string;
  service_id: string;
  slots: AvailableSlot[];
}

export interface DayAvailability {
  date: string;
  slot_count: number;
  first_slot: AvailableSlot | null;
}

export interface Booking {
  id: string;
  reference: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  notes: string;
  cancellation_reason: string | null;
  created_at: string;

  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;

  staff_id: string;
  staff_name: string;

  service_id: string;
  service_name: string;
  service_duration_min: number;
}

export interface BookingList {
  bookings: Booking[];
}

export interface WorkingHour {
  id: string;
  staff_id: string;
  /** ISO weekday: 1 = Monday .. 7 = Sunday. */
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface StaffLoad {
  staff_id: string;
  staff_name: string;
  booking_count: number;
}

export interface ServiceDemand {
  service_id: string;
  service_name: string;
  booking_count: number;
  revenue_cents: number;
}

export interface AdminOverview {
  bookings_today: number;
  bookings_upcoming: number;
  bookings_this_week: number;
  cancellations_this_week: number;
  revenue_this_week_cents: number;
  revenue_confirmed_upcoming_cents: number;
  active_services: number;
  active_staff: number;
  total_customers: number;
  busiest_staff: StaffLoad[];
  popular_services: ServiceDemand[];
}

export interface CustomerSummary extends UserProfile {
  booking_count: number;
  last_visit: string | null;
}
