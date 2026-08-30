# Karembo backend

Rust API for the Karembo salon booking app. actix-web + sqlx + PostgreSQL.

```bash
cargo run          # migrations run on boot; listens on 127.0.0.1:8080
cargo test         # unit tests
./scripts/smoke.sh # 64 HTTP checks against a running server
```

## Configuration

Read from the environment, with `.env` loaded when present. See `.env` for the
development values.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Required. Percent-encode special characters in the password. |
| `JWT_SECRET` | — | Required, min 32 chars. `openssl rand -hex 32`. |
| `BIND_ADDRESS` | `127.0.0.1:8080` | |
| `JWT_TTL_HOURS` | `24` | |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allowlist. |
| `SALON_UTC_OFFSET_HOURS` | `3` | The salon's wall-clock offset. EAT = +3, no DST. |
| `BOOKING_LEAD_MINUTES` | `60` | Minimum notice before a bookable slot. |
| `BOOKING_HORIZON_DAYS` | `60` | How far ahead customers may book. |
| `SLOT_STEP_MINUTES` | `15` | Granularity of offered start times. |
| `CANCELLATION_CUTOFF_HOURS` | `12` | Customer self-cancel cut-off. Admins override. |
| `SEED_DEMO_USERS` | `true` | Set `false` in production. |

> The development `DATABASE_URL` percent-encodes its password because the
> plaintext contains `$`, `&` and `%`. A literal `%` starts a percent-escape and
> makes the URL unparseable.

## Layout

```
src/
├── main.rs          Boot: config, pool, migrations, seed, CORS, server
├── config.rs        Environment parsing
├── error.rs         ApiError -> HTTP status + JSON body
├── models.rs        Row and response types
├── auth.rs          Argon2 hashing, JWT, AuthUser/AdminUser extractors
├── availability.rs  Slot generation (pure, unit-tested)
├── seed.rs          Demo accounts (needs Argon2, so not a SQL migration)
└── routes/
    ├── auth.rs      Register, login, profile, password
    ├── catalogue.rs Services, staff, availability
    ├── bookings.rs  Create, list, cancel, reschedule
    └── admin.rs     Overview, bookings, services, staff, rota, time off
migrations/
├── 0001_init.sql              Schema, enums, exclusion constraint, triggers
└── 0002_seed_catalogue.sql    Service menu, stylists, weekly rota
scripts/
├── psql.sh              psql via a Docker container (none installed locally)
├── smoke.sh             End-to-end HTTP test
└── constraint_check.sql Proves the double-booking guard
```

## Endpoints

Public:

```
GET    /api/health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/services            ?category=
GET    /api/categories
GET    /api/services/{slug}
GET    /api/staff               ?service_id=
GET    /api/availability        ?staff_id&service_id&date
GET    /api/availability/days   ?staff_id&service_id&from&to
```

Authenticated (`AuthUser`):

```
GET    /api/auth/me
PATCH  /api/auth/me
POST   /api/auth/password
GET    /api/bookings            ?window=upcoming|past
POST   /api/bookings
GET    /api/bookings/{id}
POST   /api/bookings/{id}/cancel
POST   /api/bookings/{id}/reschedule
```

Admin (`AdminUser`):

```
GET    /api/admin/overview
GET    /api/admin/bookings      ?status&staff_id&from&to&search
PATCH  /api/admin/bookings/{id}/status
GET    /api/admin/services
POST   /api/admin/services
PATCH  /api/admin/services/{id}
DELETE /api/admin/services/{id}          (retires; does not delete)
GET    /api/admin/staff
POST   /api/admin/staff
PATCH  /api/admin/staff/{id}
PUT    /api/admin/staff/{id}/services
GET    /api/admin/staff/{id}/working-hours
PUT    /api/admin/staff/{id}/working-hours
GET    /api/admin/staff/{id}/time-off
POST   /api/admin/staff/{id}/time-off
DELETE /api/admin/time-off/{id}
GET    /api/admin/customers     ?search
```

Errors are `{"error": {"code": "...", "message": "..."}}` with a stable `code`.

## Notes

**Availability** (`availability.rs`) is a pure function over shifts, busy
intervals, and a clock, so every rule is unit-testable without a database. An
appointment must fit wholly inside one shift, which is why a 90-minute service is
never offered at 12:00 against a 09:00–13:00 / 14:00–18:00 rota.

**Concurrency.** The pre-flight checks in `create_booking` exist for good error
messages, not correctness. The exclusion constraint on `bookings` is what
guarantees no overlap; a violation is mapped to `409` in
`From<sqlx::Error> for ApiError`.

**Queries are runtime-checked, not `query!` macros.** That keeps `cargo build`
working without a live database or a committed `.sqlx` offline cache. The
trade-off is that column/type mismatches surface at runtime rather than compile
time — the smoke test is what covers that.

**Rota changes don't cancel bookings.** Removing a shift leaves existing
appointments inside it on the calendar, so a human decides what to do. Adding
time off returns `clashing_bookings` so the UI can warn.

**`jsonwebtoken` needs an explicit crypto provider.** Version 11 ships none in
its default features and panics on first use if none is selected; `Cargo.toml`
enables `rust_crypto`.

**Never edit a migration that has already been applied** — not even a comment.
`sqlx` records a SHA-384 of each migration and refuses to start if one changed:

```
migrations failed: migration 2 was previously applied but has been modified
```

Add a new migration instead. Two things make this easy to trip over:

- `sqlx::migrate!` embeds the migration files into the binary at **compile
  time**, so reverting a `.sql` file has no effect until you rebuild. If a
  checksum error persists after you have restored the file, `touch src/main.rs`
  and rebuild.
- To recover deliberately: restore the original bytes (verify with
  `openssl dgst -sha384 -hex < migrations/0002_seed_catalogue.sql` against
  `select encode(checksum,'hex') from _sqlx_migrations`), or on a throwaway
  database, drop it and let migrations run from scratch.
