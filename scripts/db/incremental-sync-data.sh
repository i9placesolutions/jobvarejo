#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="${ROOT_DIR}/tmp"
mkdir -p "${TMP_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

for cmd in psql date tee grep; do
  require_cmd "${cmd}"
done

PSQL_BIN="${PSQL_BIN:-$(command -v psql)}"
PG_DUMP_BIN="${PG_DUMP_BIN:-}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-}"

if [[ -z "${PG_DUMP_BIN}" ]]; then
  if [[ -x "/usr/local/opt/postgresql@17/bin/pg_dump" ]]; then
    PG_DUMP_BIN="/usr/local/opt/postgresql@17/bin/pg_dump"
  else
    PG_DUMP_BIN="$(command -v pg_dump)"
  fi
fi

if [[ -z "${PG_RESTORE_BIN}" ]]; then
  if [[ -x "/usr/local/opt/postgresql@17/bin/pg_restore" ]]; then
    PG_RESTORE_BIN="/usr/local/opt/postgresql@17/bin/pg_restore"
  else
    PG_RESTORE_BIN="$(command -v pg_restore)"
  fi
fi

if [[ ! -x "${PG_DUMP_BIN}" ]]; then
  echo "pg_dump not found: ${PG_DUMP_BIN}" >&2
  exit 1
fi

if [[ ! -x "${PG_RESTORE_BIN}" ]]; then
  echo "pg_restore not found: ${PG_RESTORE_BIN}" >&2
  exit 1
fi

echo "Using tools:"
echo "  psql: ${PSQL_BIN}"
echo "  pg_dump: ${PG_DUMP_BIN}"
echo "  pg_restore: ${PG_RESTORE_BIN}"

SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"

if [[ -z "${SOURCE_DATABASE_URL}" ]]; then
  echo "Missing SOURCE_DATABASE_URL."
  echo "Example: export SOURCE_DATABASE_URL='postgresql://postgres:***@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'"
  exit 1
fi

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "Missing TARGET_DATABASE_URL."
  echo "Example: export TARGET_DATABASE_URL='postgresql://postgres:***@147.93.139.212:3000/postgres?sslmode=disable'"
  exit 1
fi

DUMP_FILE="${DUMP_FILE:-${TMP_DIR}/supabase_data_sync_$(date +%Y%m%d_%H%M%S).dump}"

SCHEMAS=(public auth storage supabase_migrations)
dump_schema_args=()
for schema in "${SCHEMAS[@]}"; do
  dump_schema_args+=("--schema=${schema}")
done

echo "1) Creating data-only dump from source..."
"${PG_DUMP_BIN}" "${SOURCE_DATABASE_URL}" \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  "${dump_schema_args[@]}" \
  --file "${DUMP_FILE}"

echo "2) Truncating destination tables..."
truncate_statements="$(
  "${PSQL_BIN}" "${TARGET_DATABASE_URL}" -tA -c \
    "select format('TRUNCATE TABLE %I.%I CASCADE;', schemaname, tablename) from pg_tables where schemaname in ('public','auth','storage','supabase_migrations') order by schemaname, tablename;"
)"

if [[ -z "${truncate_statements}" ]]; then
  echo "No destination tables found in expected schemas."
  exit 1
fi

printf '%s\n' "${truncate_statements}" | "${PSQL_BIN}" "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 >/dev/null

echo "3) Restoring data into destination..."
RESTORE_LOG="${DUMP_FILE}.restore.log"
set +e
"${PG_RESTORE_BIN}" \
  --dbname="${TARGET_DATABASE_URL}" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  "${DUMP_FILE}" 2>&1 | tee "${RESTORE_LOG}"
restore_exit="${PIPESTATUS[0]}"
set -e

if [[ "${restore_exit}" -ne 0 ]]; then
  filtered_errors="$(
    grep -Ev 'unrecognized configuration parameter "transaction_timeout"|SET transaction_timeout = 0;|errors ignored on restore: 1' "${RESTORE_LOG}" || true
  )"
  if [[ -n "${filtered_errors}" ]]; then
    echo "Restore failed with unexpected errors. Check: ${RESTORE_LOG}" >&2
    exit "${restore_exit}"
  fi
  echo "Restore completed with a known PG17->PG16 compatibility warning (transaction_timeout)."
fi

echo "4) Running smoke test comparison..."
TARGET_DATABASE_URL="${TARGET_DATABASE_URL}" \
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL}" \
bash "${ROOT_DIR}/scripts/db/smoke-test.sh"

echo "Incremental data sync completed successfully."
echo "Dump file: ${DUMP_FILE}"
