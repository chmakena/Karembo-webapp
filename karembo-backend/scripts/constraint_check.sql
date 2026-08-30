-- Proves the bookings_no_staff_overlap exclusion constraint behaves as intended.
-- Run against a scratch database that already has 0001 + 0002 applied.
\set ON_ERROR_STOP off

INSERT INTO users (email, password_hash, full_name, role)
VALUES ('check@example.com', 'not-a-real-hash', 'Constraint Check', 'customer');

-- Booking A: Amina, Saturday 10:00-11:00.
INSERT INTO bookings (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents)
SELECT 'CHK-A',
       (SELECT id FROM users WHERE email = 'check@example.com'),
       (SELECT id FROM staff WHERE display_name = 'Amina Karisa'),
       (SELECT id FROM services WHERE slug = 'signature-cut'),
       '2026-09-05 10:00:00+03', '2026-09-05 11:00:00+03', 250000;

\echo '--- 1. overlapping booking for the SAME stylist must FAIL ---'
INSERT INTO bookings (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents)
SELECT 'CHK-B',
       (SELECT id FROM users WHERE email = 'check@example.com'),
       (SELECT id FROM staff WHERE display_name = 'Amina Karisa'),
       (SELECT id FROM services WHERE slug = 'silk-press'),
       '2026-09-05 10:30:00+03', '2026-09-05 12:00:00+03', 380000;

\echo '--- 2. back-to-back booking (starts exactly when A ends) must SUCCEED ---'
INSERT INTO bookings (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents)
SELECT 'CHK-C',
       (SELECT id FROM users WHERE email = 'check@example.com'),
       (SELECT id FROM staff WHERE display_name = 'Amina Karisa'),
       (SELECT id FROM services WHERE slug = 'signature-cut'),
       '2026-09-05 11:00:00+03', '2026-09-05 12:00:00+03', 250000;

\echo '--- 3. same time, DIFFERENT stylist must SUCCEED ---'
INSERT INTO bookings (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents)
SELECT 'CHK-D',
       (SELECT id FROM users WHERE email = 'check@example.com'),
       (SELECT id FROM staff WHERE display_name = 'Brian Otieno'),
       (SELECT id FROM services WHERE slug = 'signature-cut'),
       '2026-09-05 10:00:00+03', '2026-09-05 11:00:00+03', 250000;

\echo '--- 4. cancelling A then rebooking its slot must SUCCEED ---'
UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE reference = 'CHK-A';
INSERT INTO bookings (reference, customer_id, staff_id, service_id, starts_at, ends_at, price_cents)
SELECT 'CHK-E',
       (SELECT id FROM users WHERE email = 'check@example.com'),
       (SELECT id FROM staff WHERE display_name = 'Amina Karisa'),
       (SELECT id FROM services WHERE slug = 'signature-cut'),
       '2026-09-05 10:00:00+03', '2026-09-05 11:00:00+03', 250000;

\echo '--- final state ---'
SELECT b.reference, s.display_name, b.starts_at::time AS starts, b.ends_at::time AS ends, b.status
FROM bookings b JOIN staff s ON s.id = b.staff_id
ORDER BY b.reference;
