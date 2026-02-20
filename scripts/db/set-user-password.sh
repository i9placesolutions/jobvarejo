#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

for cmd in psql node; do
  require_cmd "${cmd}"
done

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "Missing TARGET_DATABASE_URL."
  echo "Example: export TARGET_DATABASE_URL='postgresql://postgres:***@147.93.139.212:3000/postgres?sslmode=disable'"
  exit 1
fi

if [[ -z "${EMAIL}" ]]; then
  echo "Missing EMAIL."
  echo "Example: export EMAIL='admin@empresa.com'"
  exit 1
fi

if [[ "${#PASSWORD}" -lt 8 ]]; then
  echo "PASSWORD must have at least 8 characters." >&2
  exit 1
fi

PASSWORD_HASH="$(
  node -e 'const c=require("crypto"); const p=String(process.env.PASSWORD || ""); const s=c.randomBytes(16).toString("hex"); const k=c.scryptSync(p,s,64).toString("hex"); process.stdout.write(`scrypt$${s}$${k}`);'
)"

EMAIL_ESCAPED="${EMAIL//\'/\'\'}"
HASH_ESCAPED="${PASSWORD_HASH//\'/\'\'}"

rows_updated="$(
  psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -tA -c "with updated as (
    update public.profiles
    set password_hash = '${HASH_ESCAPED}',
        updated_at = timezone('utc', now())
    where lower(email) = lower('${EMAIL_ESCAPED}')
    returning id
  )
  select count(*) from updated;"
)"

rows_updated="$(echo "${rows_updated}" | tr -d '[:space:]')"

if [[ "${rows_updated}" != "1" ]]; then
  echo "Expected to update exactly 1 user, updated=${rows_updated}." >&2
  exit 1
fi

echo "Password updated successfully for ${EMAIL}."
