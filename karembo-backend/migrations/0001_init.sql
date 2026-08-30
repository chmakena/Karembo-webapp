-- Karembo salon booking — core schema
-- btree_gist backs the exclusion constraint that makes double-booking a staff
-- member impossible at the storage layer, not just in application code.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('customer', 'staff', 'admin');

CREATE TYPE booking_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
);

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    password_hash text NOT NULL,
    full_name     text NOT NULL,
    phone         text,
    role          user_role NOT NULL DEFAULT 'customer',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Emails are compared case-insensitively; store whatever the user typed but
-- keep uniqueness on the folded form.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE services (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         text NOT NULL UNIQUE,
    name         text NOT NULL,
    description  text NOT NULL DEFAULT '',
    category     text NOT NULL,
    duration_min integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 600),
    price_cents  integer NOT NULL CHECK (price_cents >= 0),
    image_url    text,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_category_idx ON services (category) WHERE is_active;

CREATE TABLE staff (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid UNIQUE REFERENCES users (id) ON DELETE SET NULL,
    display_name text NOT NULL,
    title        text NOT NULL DEFAULT 'Stylist',
    bio          text NOT NULL DEFAULT '',
    avatar_url   text,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Which stylist can perform which service.
CREATE TABLE staff_services (
    staff_id   uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX staff_services_service_idx ON staff_services (service_id);

-- Recurring weekly availability. weekday follows ISO-8601: 1 = Monday .. 7 = Sunday.
CREATE TABLE working_hours (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time time NOT NULL,
    end_time   time NOT NULL,
    CONSTRAINT working_hours_range_valid CHECK (start_time < end_time),
    CONSTRAINT working_hours_unique_shift UNIQUE (staff_id, weekday, start_time)
);

CREATE INDEX working_hours_staff_weekday_idx ON working_hours (staff_id, weekday);

-- One-off absences (holiday, sick leave) that override working_hours.
CREATE TABLE time_off (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id  uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at   timestamptz NOT NULL,
    reason    text NOT NULL DEFAULT '',
    CONSTRAINT time_off_range_valid CHECK (starts_at < ends_at)
);

CREATE INDEX time_off_staff_window_idx ON time_off (staff_id, starts_at, ends_at);

CREATE TABLE bookings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference           text NOT NULL UNIQUE,
    customer_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    staff_id            uuid NOT NULL REFERENCES staff (id) ON DELETE RESTRICT,
    service_id          uuid NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
    starts_at           timestamptz NOT NULL,
    ends_at             timestamptz NOT NULL,
    status              booking_status NOT NULL DEFAULT 'confirmed',
    -- Price is captured at booking time so later price changes don't rewrite history.
    price_cents         integer NOT NULL CHECK (price_cents >= 0),
    notes               text NOT NULL DEFAULT '',
    cancellation_reason text,
    cancelled_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bookings_range_valid CHECK (starts_at < ends_at),
    -- A stylist cannot hold two live bookings that overlap in time. Cancelled and
    -- no-show bookings are excluded so their slots become bookable again.
    CONSTRAINT bookings_no_staff_overlap EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
    ) WHERE (status IN ('pending', 'confirmed', 'completed'))
);

CREATE INDEX bookings_customer_idx ON bookings (customer_id, starts_at DESC);
CREATE INDEX bookings_staff_window_idx ON bookings (staff_id, starts_at);
CREATE INDEX bookings_status_idx ON bookings (status, starts_at);

-- Keep updated_at honest without requiring every UPDATE to remember it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER staff_set_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
