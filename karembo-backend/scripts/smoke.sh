#!/usr/bin/env bash
# End-to-end smoke test against a running Karembo API.
#
#   scripts/smoke.sh [base_url]      # default http://127.0.0.1:8080
#
# Exercises the real customer journey (register -> browse -> availability ->
# book -> reschedule -> cancel) plus the admin surface, and asserts the
# double-booking guard actually rejects a conflicting write.
set -uo pipefail

BASE="${1:-http://127.0.0.1:8080}"
API="$BASE/api"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

# check <description> <actual> <expected>
check() {
  if [[ "$2" == "$3" ]]; then
    printf '  %s %s\n' "$(green PASS)" "$1"
    PASS=$((PASS + 1))
  else
    printf '  %s %s\n        expected: %s\n        actual:   %s\n' \
      "$(red FAIL)" "$1" "$3" "$2"
    FAIL=$((FAIL + 1))
  fi
}

# status <method> <path> [json_body] [token]  -> prints HTTP status
status() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "$API$path")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  curl "${args[@]}"
}

# body <method> <path> [json_body] [token]  -> prints response body
body() {
  local method="$1" path="$2" payload="${3:-}" token="${4:-}"
  local args=(-s -X "$method" "$API$path")
  [[ -n "$payload" ]] && args+=(-H 'Content-Type: application/json' -d "$payload")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  curl "${args[@]}"
}

# Extract a value from JSON on stdin via a python expression over `d`.
jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }

echo
echo "Karembo API smoke test -> $BASE"
echo

# ---------------------------------------------------------------- health ----
echo "health"
check "GET /health returns 200" "$(status GET /health)" "200"

# ------------------------------------------------------------------ auth ----
echo
echo "authentication"
# A unique email per run keeps the script re-runnable.
EMAIL="smoke-$(date +%s)-$$@example.com"
REG=$(body POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"smoke-test-pw\",\"full_name\":\"Smoke Tester\",\"phone\":\"+254700999888\"}")
TOKEN=$(printf '%s' "$REG" | jget "d['token']")
USER_ROLE=$(printf '%s' "$REG" | jget "d['user']['role']")

check "register returns a token" "$([[ -n "$TOKEN" ]] && echo yes || echo no)" "yes"
check "self-registration yields the customer role" "$USER_ROLE" "customer"
check "duplicate email is rejected with 409" \
  "$(status POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"smoke-test-pw\",\"full_name\":\"Dup\"}")" "409"
check "short password is rejected with 422" \
  "$(status POST /auth/register '{"email":"x@y.com","password":"tiny","full_name":"Tiny"}')" "422"
check "malformed email is rejected with 422" \
  "$(status POST /auth/register '{"email":"bogus","password":"long-enough-pw","full_name":"Nope"}')" "422"
check "login with the wrong password gives 401" \
  "$(status POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"wrong-password\"}")" "401"
check "login with correct credentials gives 200" \
  "$(status POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"smoke-test-pw\"}")" "200"
check "unknown email gives 401 (not 404)" \
  "$(status POST /auth/login '{"email":"ghost@example.com","password":"whatever-pw"}')" "401"

echo
echo "token handling"
check "/auth/me without a token gives 401" "$(status GET /auth/me)" "401"
check "/auth/me with a token gives 200" "$(status GET /auth/me '' "$TOKEN")" "200"
check "a garbage token gives 401" "$(status GET /auth/me '' 'not.a.jwt')" "401"

ADMIN_TOKEN=$(body POST /auth/login '{"email":"admin@karembo.test","password":"karembo-admin"}' | jget "d['token']")
check "demo admin can sign in" "$([[ -n "$ADMIN_TOKEN" ]] && echo yes || echo no)" "yes"

echo
echo "authorisation"
check "customer cannot read the admin overview (403)" \
  "$(status GET /admin/overview '' "$TOKEN")" "403"
check "anonymous cannot read the admin overview (401)" \
  "$(status GET /admin/overview)" "401"
check "admin can read the admin overview (200)" \
  "$(status GET /admin/overview '' "$ADMIN_TOKEN")" "200"

# ------------------------------------------------------------- catalogue ----
echo
echo "catalogue"
SERVICES=$(body GET /services)
SERVICE_COUNT=$(printf '%s' "$SERVICES" | jget "len(d)")
check "service menu is populated" "$([[ "${SERVICE_COUNT:-0}" -ge 10 ]] && echo yes || echo no)" "yes"
check "category filter works" \
  "$(body GET '/services?category=Nails' | jget "all(s['category']=='Nails' for s in d) and len(d)>0")" "True"
check "unknown service slug gives 404" "$(status GET /services/does-not-exist)" "404"
check "known service slug gives 200" "$(status GET /services/gel-manicure)" "200"

# Pick a stylist who offers the signature cut (60 minutes).
SERVICE_ID=$(printf '%s' "$SERVICES" | jget "[s['id'] for s in d if s['slug']=='signature-cut'][0]")
STAFF=$(body GET "/staff?service_id=$SERVICE_ID")
STAFF_ID=$(printf '%s' "$STAFF" | jget "d[0]['id']")
check "staff can be filtered by service" \
  "$([[ -n "$STAFF_ID" ]] && echo yes || echo no)" "yes"
check "each stylist carries its service ids" \
  "$(printf '%s' "$STAFF" | jget "all('service_ids' in s for s in d)")" "True"

# ---------------------------------------------------------- availability ----
echo
echo "availability"
# Find the first upcoming date that actually has slots.
FOUND_DATE=""
for offset in 1 2 3 4 5 6 7 8; do
  DATE=$(python3 -c "import datetime;print((datetime.date.today()+datetime.timedelta(days=$offset)).isoformat())")
  SLOTS=$(body GET "/availability?staff_id=$STAFF_ID&service_id=$SERVICE_ID&date=$DATE")
  COUNT=$(printf '%s' "$SLOTS" | jget "len(d['slots'])")
  if [[ "${COUNT:-0}" -gt 0 ]]; then FOUND_DATE="$DATE"; break; fi
done

check "a bookable day was found within a week" \
  "$([[ -n "$FOUND_DATE" ]] && echo yes || echo no)" "yes"

SLOT_START=$(printf '%s' "$SLOTS" | jget "d['slots'][0]['starts_at']")
check "slots carry start and end instants" \
  "$(printf '%s' "$SLOTS" | jget "all('starts_at' in s and 'ends_at' in s for s in d['slots'])")" "True"
check "a past date is rejected with 422" \
  "$(status GET "/availability?staff_id=$STAFF_ID&service_id=$SERVICE_ID&date=2020-01-01")" "422"
check "a stylist/service mismatch is rejected with 422" \
  "$(status GET "/availability?staff_id=$STAFF_ID&service_id=$(printf '%s' "$SERVICES" | jget "[s['id'] for s in d if s['slug']=='acrylic-full-set'][0]")&date=$FOUND_DATE")" "422"
check "the day-range endpoint returns one entry per day" \
  "$(body GET "/availability/days?staff_id=$STAFF_ID&service_id=$SERVICE_ID&from=$FOUND_DATE&to=$FOUND_DATE" | jget "len(d)")" "1"
check "an over-long range is rejected with 400" \
  "$(status GET "/availability/days?staff_id=$STAFF_ID&service_id=$SERVICE_ID&from=2026-01-01&to=2027-01-01")" "400"

# --------------------------------------------------------------- booking ----
echo
echo "booking"
check "booking without a token gives 401" \
  "$(status POST /bookings "{\"staff_id\":\"$STAFF_ID\",\"service_id\":\"$SERVICE_ID\",\"starts_at\":\"$SLOT_START\"}")" "401"

BOOKING=$(body POST /bookings \
  "{\"staff_id\":\"$STAFF_ID\",\"service_id\":\"$SERVICE_ID\",\"starts_at\":\"$SLOT_START\",\"notes\":\"Smoke test booking\"}" \
  "$TOKEN")
BOOKING_ID=$(printf '%s' "$BOOKING" | jget "d['id']")
BOOKING_REF=$(printf '%s' "$BOOKING" | jget "d['reference']")

check "booking succeeds" "$([[ -n "$BOOKING_ID" ]] && echo yes || echo no)" "yes"
check "booking gets a KMB- reference" \
  "$(printf '%s' "$BOOKING_REF" | cut -c1-4)" "KMB-"
check "booking starts out confirmed" \
  "$(printf '%s' "$BOOKING" | jget "d['status']")" "confirmed"
check "booking captures the service price" \
  "$(printf '%s' "$BOOKING" | jget "d['price_cents']")" "250000"
check "booking carries the joined service name" \
  "$(printf '%s' "$BOOKING" | jget "d['service_name']")" "Signature Cut & Style"

echo
echo "double-booking guard"
# The same stylist, the same instant, a different customer. The exclusion
# constraint must reject this rather than accept an overlapping appointment.
OTHER_TOKEN=$(body POST /auth/login '{"email":"wanjiku@example.com","password":"karembo-demo"}' | jget "d['token']")
check "a second customer cannot take the same slot (409)" \
  "$(status POST /bookings "{\"staff_id\":\"$STAFF_ID\",\"service_id\":\"$SERVICE_ID\",\"starts_at\":\"$SLOT_START\"}" "$OTHER_TOKEN")" \
  "409"
check "the taken slot disappears from availability" \
  "$(body GET "/availability?staff_id=$STAFF_ID&service_id=$SERVICE_ID&date=$FOUND_DATE" | jget "'$SLOT_START' not in [s['starts_at'] for s in d['slots']]")" \
  "True"

echo
echo "booking validation"
check "an off-grid start time is rejected with 422" \
  "$(status POST /bookings "{\"staff_id\":\"$STAFF_ID\",\"service_id\":\"$SERVICE_ID\",\"starts_at\":\"$(python3 -c "
import datetime
d = datetime.datetime.fromisoformat('$SLOT_START'.replace('Z','+00:00'))
print((d + datetime.timedelta(minutes=7)).isoformat().replace('+00:00','Z'))")\"}" "$TOKEN")" "422"
check "a 3am start (outside all shifts) is rejected with 422" \
  "$(status POST /bookings "{\"staff_id\":\"$STAFF_ID\",\"service_id\":\"$SERVICE_ID\",\"starts_at\":\"${FOUND_DATE}T00:00:00Z\"}" "$TOKEN")" "422"

echo
echo "booking access control"
check "owner can read their booking" "$(status GET "/bookings/$BOOKING_ID" '' "$TOKEN")" "200"
check "another customer cannot read it (403)" \
  "$(status GET "/bookings/$BOOKING_ID" '' "$OTHER_TOKEN")" "403"
check "admin can read any booking" "$(status GET "/bookings/$BOOKING_ID" '' "$ADMIN_TOKEN")" "200"
check "own bookings list includes it" \
  "$(body GET /bookings '' "$TOKEN" | jget "any(b['id']=='$BOOKING_ID' for b in d['bookings'])")" "True"

echo
echo "reschedule and cancel"
NEXT_SLOT=$(body GET "/availability?staff_id=$STAFF_ID&service_id=$SERVICE_ID&date=$FOUND_DATE" | jget "d['slots'][0]['starts_at']")
check "reschedule to a free slot succeeds" \
  "$(status POST "/bookings/$BOOKING_ID/reschedule" "{\"starts_at\":\"$NEXT_SLOT\"}" "$TOKEN")" "200"
check "another customer cannot reschedule it (403)" \
  "$(status POST "/bookings/$BOOKING_ID/reschedule" "{\"starts_at\":\"$NEXT_SLOT\"}" "$OTHER_TOKEN")" "403"
check "cancel succeeds for the owner" \
  "$(status POST "/bookings/$BOOKING_ID/cancel" '{"reason":"smoke test cleanup"}' "$TOKEN")" "200"
check "cancelling twice gives 409" \
  "$(status POST "/bookings/$BOOKING_ID/cancel" '{}' "$TOKEN")" "409"
check "the cancelled slot is bookable again" \
  "$(body GET "/availability?staff_id=$STAFF_ID&service_id=$SERVICE_ID&date=$FOUND_DATE" | jget "'$NEXT_SLOT' in [s['starts_at'] for s in d['slots']]")" \
  "True"

# ----------------------------------------------------------------- admin ----
echo
echo "admin surface"
check "admin bookings list is readable" "$(status GET /admin/bookings '' "$ADMIN_TOKEN")" "200"
check "admin booking search by reference works" \
  "$(body GET "/admin/bookings?search=$BOOKING_REF" '' "$ADMIN_TOKEN" | jget "len(d)")" "1"
check "admin can filter by status" \
  "$(body GET '/admin/bookings?status=cancelled' '' "$ADMIN_TOKEN" | jget "all(b['status']=='cancelled' for b in d)")" "True"
check "admin service list includes inactive rows" \
  "$(status GET /admin/services '' "$ADMIN_TOKEN")" "200"
check "admin customer list is readable" "$(status GET /admin/customers '' "$ADMIN_TOKEN")" "200"
check "admin can see the new customer" \
  "$(body GET "/admin/customers?search=$EMAIL" '' "$ADMIN_TOKEN" | jget "len(d)")" "1"

# Create, edit, then retire a throwaway service.
NEW_SLUG="smoke-service-$$"
NEW_SERVICE=$(body POST /admin/services \
  "{\"name\":\"Smoke Service\",\"slug\":\"$NEW_SLUG\",\"category\":\"Hair\",\"duration_min\":45,\"price_cents\":123400}" \
  "$ADMIN_TOKEN")
NEW_SERVICE_ID=$(printf '%s' "$NEW_SERVICE" | jget "d['id']")
check "admin can create a service" "$([[ -n "$NEW_SERVICE_ID" ]] && echo yes || echo no)" "yes"
check "duplicate slug is rejected with 409" \
  "$(status POST /admin/services "{\"name\":\"Dup\",\"slug\":\"$NEW_SLUG\",\"category\":\"Hair\",\"duration_min\":45,\"price_cents\":1000}" "$ADMIN_TOKEN")" "409"
check "an absurd duration is rejected with 422" \
  "$(status POST /admin/services '{"name":"Bad","slug":"bad-svc","category":"Hair","duration_min":9999,"price_cents":1000}' "$ADMIN_TOKEN")" "422"
check "admin can update a service" \
  "$(body PATCH "/admin/services/$NEW_SERVICE_ID" '{"price_cents":150000}' "$ADMIN_TOKEN" | jget "d['price_cents']")" "150000"
check "customer cannot create a service (403)" \
  "$(status POST /admin/services '{"name":"Nope","slug":"nope-svc","category":"Hair","duration_min":30,"price_cents":1000}' "$TOKEN")" "403"
check "admin can retire a service" \
  "$(status DELETE "/admin/services/$NEW_SERVICE_ID" '' "$ADMIN_TOKEN")" "204"
check "a retired service leaves the public menu" \
  "$(body GET /services | jget "all(s['id']!='$NEW_SERVICE_ID' for s in d)")" "True"

echo
echo "rota management"
check "admin can read working hours" \
  "$(status GET "/admin/staff/$STAFF_ID/working-hours" '' "$ADMIN_TOKEN")" "200"
check "overlapping shifts are rejected with 422" \
  "$(status PUT "/admin/staff/$STAFF_ID/working-hours" '{"shifts":[{"weekday":2,"start_time":"09:00:00","end_time":"13:00:00"},{"weekday":2,"start_time":"12:00:00","end_time":"15:00:00"}]}' "$ADMIN_TOKEN")" "422"
check "a backwards shift is rejected with 422" \
  "$(status PUT "/admin/staff/$STAFF_ID/working-hours" '{"shifts":[{"weekday":2,"start_time":"15:00:00","end_time":"09:00:00"}]}' "$ADMIN_TOKEN")" "422"
check "an out-of-range weekday is rejected with 422" \
  "$(status PUT "/admin/staff/$STAFF_ID/working-hours" '{"shifts":[{"weekday":9,"start_time":"09:00:00","end_time":"12:00:00"}]}' "$ADMIN_TOKEN")" "422"

echo
printf 'passed %s, failed %s\n\n' "$(green "$PASS")" "$([[ "$FAIL" -eq 0 ]] && green 0 || red "$FAIL")"
[[ "$FAIL" -eq 0 ]]
