#!/usr/bin/env bash
# Thin psql wrapper.
#
# No psql client is installed on this machine, so we borrow the one inside a
# running postgres container and point it back at the host database.
#
# The password is never hardcoded here — this file is committed. It is read from
# PGPASSWORD, or parsed out of ../.env (which is gitignored).
#
# Usage:
#   scripts/psql.sh [-d dbname] [psql args...]        # also reads SQL from stdin
#   PGDATABASE=postgres scripts/psql.sh -c '\l'
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/../.env"

CONTAINER="${KAREMBO_PSQL_CONTAINER:-kastaem_postgres}"
HOST="${PGHOST:-host.docker.internal}"
PORT="${PGPORT:-5432}"
USER="${PGUSER:-postgres}"
DB="${PGDATABASE:-karembo}"

# Pull the password out of DATABASE_URL in .env when not already in the
# environment. The URL stores it percent-encoded, so decode it back.
if [[ -z "${PGPASSWORD:-}" && -f "${ENV_FILE}" ]]; then
  url="$(grep -m1 '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2- | tr -d "'\"")"
  encoded="${url#*://*:}"
  encoded="${encoded%%@*}"
  PGPASSWORD="$(printf '%b' "${encoded//%/\\x}")"
fi

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "psql.sh: set PGPASSWORD, or provide DATABASE_URL in ${ENV_FILE}" >&2
  exit 1
fi

exec docker exec -i \
  -e "PGPASSWORD=${PGPASSWORD}" \
  "${CONTAINER}" \
  psql -h "${HOST}" -p "${PORT}" -U "${USER}" -d "${DB}" -v ON_ERROR_STOP=1 "$@"
