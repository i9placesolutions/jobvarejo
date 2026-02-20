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

for cmd in psql diff wc sort; do
  require_cmd "${cmd}"
done

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-}"

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "Missing TARGET_DATABASE_URL."
  echo "Example: export TARGET_DATABASE_URL='postgresql://postgres:***@147.93.139.212:3000/postgres?sslmode=disable'"
  exit 1
fi

TABLES_SQL="select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth','storage','supabase_migrations') order by 1;"
META_SQL="select 'policies|'||count(*) from pg_policies where schemaname in ('public','auth','storage') union all select 'triggers|'||count(*) from information_schema.triggers where trigger_schema in ('public','auth','storage');"

collect_counts() {
  local db_url="$1"
  local out_file="$2"

  : > "${out_file}"
  while IFS= read -r table_full; do
    [[ -z "${table_full}" ]] && continue
    local schema="${table_full%%.*}"
    local table="${table_full#*.}"
    local count
    count="$(psql "${db_url}" -tA -c "select count(*) from \"${schema}\".\"${table}\";")"
    echo "${schema}.${table}|${count}" >> "${out_file}"
  done < <(psql "${db_url}" -tA -c "${TABLES_SQL}")
}

echo "== Target connection =="
psql "${TARGET_DATABASE_URL}" -tAc "select current_database(), current_user, version();"

collect_counts "${TARGET_DATABASE_URL}" "${TMP_DIR}/target_counts_latest.txt"
psql "${TARGET_DATABASE_URL}" -tA -c "${META_SQL}" | sort > "${TMP_DIR}/target_meta_latest.txt"

target_tables="$(wc -l < "${TMP_DIR}/target_counts_latest.txt" | tr -d ' ')"
echo "== Target summary =="
echo "tables=${target_tables}"
cat "${TMP_DIR}/target_meta_latest.txt"

if [[ -n "${SOURCE_DATABASE_URL}" ]]; then
  echo "== Source connection =="
  psql "${SOURCE_DATABASE_URL}" -tAc "select current_database(), current_user, version();"

  collect_counts "${SOURCE_DATABASE_URL}" "${TMP_DIR}/source_counts_latest.txt"
  psql "${SOURCE_DATABASE_URL}" -tA -c "${META_SQL}" | sort > "${TMP_DIR}/source_meta_latest.txt"

  source_tables="$(wc -l < "${TMP_DIR}/source_counts_latest.txt" | tr -d ' ')"
  echo "== Source summary =="
  echo "tables=${source_tables}"
  cat "${TMP_DIR}/source_meta_latest.txt"

  echo "== Diff counts =="
  diff -u "${TMP_DIR}/source_counts_latest.txt" "${TMP_DIR}/target_counts_latest.txt" || true
  echo "== Diff metadata =="
  diff -u "${TMP_DIR}/source_meta_latest.txt" "${TMP_DIR}/target_meta_latest.txt" || true
fi

echo "Smoke test completed."
