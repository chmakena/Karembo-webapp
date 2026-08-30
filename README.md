# Karembo

A full-stack salon booking app for a fictional salon on Nyali Road, Mombasa.

| | |
|---|---|
| **Backend** | Rust · actix-web · sqlx · PostgreSQL · JWT |
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind v4 · TanStack Query |
| **Design** | Token-based design system + 11 static HTML screen mockups |

```
karembo/
├── design/            UI/UX design system and screen mockups  → design/README.md
├── karembo-backend/   Rust API                                → karembo-backend/README.md
└── karembo-frontend/  Next.js app
```

---

## Running it

Both services need to be up. Postgres must be running on `localhost:5432` with a
database named `karembo`.

**1. Backend** (`http://127.0.0.1:8080`)

```bash
cd karembo-backend
cargo run
```

Migrations are embedded in the binary and run on boot, so there is no separate
migration step. The service menu, stylists and weekly rota are seeded by
migration; the demo user accounts are created on first boot.

**2. Frontend** (`http://localhost:3000`)

```bash
cd karembo-frontend
npm install
npm run dev
```

**3. Design mockups** — open `design/index.html` in a browser. No server needed.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@karembo.test` | `karembo-admin` |
| Customer | `wanjiku@example.com` | `karembo-demo` |
| Customer | `james@example.com` | `karembo-demo` |

Set `SEED_DEMO_USERS=false` to stop these being created.

---

## What it does

**Customers** browse a service menu with real durations and prices, pick a
stylist qualified for that service, choose from time slots that are genuinely
free, and book. They can then view, and cancel their appointments themselves up
to 12 hours before.

**Staff** get a dashboard with the day's diary and weekly figures, a filterable
list of every booking with status controls, service catalogue management, and
per-stylist rota, service coverage and time off.

---

## The parts worth knowing about

### Double-booking is impossible at the database level

The `bookings` table carries a GiST exclusion constraint:

```sql
CONSTRAINT bookings_no_staff_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'completed'))
```

Two customers racing for the same slot cannot both win, regardless of what the
application code does — Postgres rejects the second write. The API translates
that rejection into a `409` and the UI re-fetches availability and says "that
slot has just been taken".

Three details matter:

- The range is **half-open** `[)`, so an appointment ending at 11:00 and another
  starting at 11:00 do not clash. Back-to-back bookings work.
- The `WHERE` clause **excludes cancelled and no-show** bookings, so cancelling
  genuinely frees the slot for someone else.
- `price_cents` is captured on the booking, so changing a service's price later
  doesn't rewrite booking history.

`karembo-backend/scripts/constraint_check.sql` demonstrates all four behaviours.

### Time is handled in the salon's timezone, not the server's or browser's

Availability is a statement about local wall-clock time: "Amina works 09:00–13:00
on Tuesdays" means Nairobi time. The backend stores instants in UTC and converts
using a configured offset (`SALON_UTC_OFFSET_HOURS`, default +3); the frontend
renders every time with `timeZone: "Africa/Nairobi"`.

A customer booking from London therefore sees the Mombasa time they need to turn
up at, not 07:30 because their laptop is on BST. EAT has no daylight saving, so a
fixed offset is exact here — a DST-observing region would need a full IANA
timezone database instead.

### Authorisation is enforced by extractor, not by path

Handlers take `AuthUser` (any valid token) or `AdminUser` (admin role) as an
argument. Extraction fails with 401 or 403 before the handler body runs, so an
admin route cannot be left unguarded by forgetting a check. The frontend's
`AdminGate` is presentation only — it prevents a non-admin seeing a dashboard
full of errors, and is not what stops access.

### The design tokens have one implementation

`design/assets/tokens.css` is the design reference; `karembo-frontend/app/globals.css`
declares the same values through Tailwind's `@theme`. `python3 design/contrast.py`
checks all 24 foreground/background pairs against WCAG AA, so a palette change
can't silently break contrast.

---

## Tests

```bash
# Backend unit tests — availability engine, JWT, password hashing, validation
cd karembo-backend && cargo test

# API integration — 64 checks over the full HTTP surface (needs the server up)
cd karembo-backend && ./scripts/smoke.sh

# Design system contrast
python3 design/contrast.py
```

The API smoke test covers the booking race explicitly: it books a slot, then
tries to book the same slot as a different customer and asserts a 409.

A browser-driven end-to-end suite (46 checks over the customer and admin
journeys, using `puppeteer-core` against the real app) was used during
development but is not committed, since it would add a browser automation
dependency to the repo for a single script.

### Known gaps

Deliberately out of scope for this build, in rough order of how much they'd
matter next:

- **No notifications.** Booking confirmations aren't emailed or texted; the
  confirmation screen and bookings page are the only record the customer gets.
- **No payments.** Services are paid for at the salon; nothing takes a deposit.
- **No staff self-service.** Stylists have no logins — the `staff.user_id` column
  and the `staff` role exist for it, but there's no portal. Front desk does
  everything.
- **No reschedule in the UI.** The API supports it
  (`POST /api/bookings/{id}/reschedule`, covered by the smoke test) but the
  customer UI only offers cancel-and-rebook.
- **No reviews, promo codes, or reporting exports.**
- **Tokens live in `localStorage`.** Fine for this build, but a production
  deployment should move to httpOnly cookies to reduce XSS exposure, and add
  refresh tokens — sessions currently just expire after 24 hours.
