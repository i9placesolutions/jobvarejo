#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ -z "${REPO}" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    origin_url="$(git remote get-url origin)"
    REPO="$(echo "${origin_url}" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
  fi
fi

if [[ -z "${REPO}" ]]; then
  echo "Missing repository slug. Usage: bash scripts/sync-github-secrets.sh owner/repo" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Missing GitHub CLI (gh). Install: https://cli.github.com/" >&2
  exit 1
fi

get_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | head -n1 || true)"
  if [[ -z "${line}" ]]; then
    echo ""
    return
  fi
  echo "${line#*=}"
}

set_secret_if_present() {
  local key="$1"
  local value
  value="$(get_env_value "${key}")"
  if [[ -z "${value}" ]]; then
    echo "skip ${key} (empty)"
    return
  fi
  printf '%s' "${value}" | gh secret set "${key}" --repo "${REPO}"
  echo "ok   ${key}"
}

SECRETS=(
  POSTGRES_DATABASE_URL
  AUTH_JWT_SECRET
  WASABI_ENDPOINT
  WASABI_BUCKET
  WASABI_ACCESS_KEY
  WASABI_SECRET_KEY
  WASABI_REGION
  NUXT_OPENAI_API_KEY
  OPENAI_API_KEY
  NUXT_SERPER_API_KEY
  SERPER_API_KEY
  SMTP_HOST
  SMTP_PORT
  SMTP_SECURE
  SMTP_USER
  SMTP_PASS
  SMTP_FROM
  APP_BASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  TARGET_DATABASE_URL
  SOURCE_DATABASE_URL
)

echo "Syncing GitHub secrets to ${REPO} from ${ENV_FILE}..."
for key in "${SECRETS[@]}"; do
  set_secret_if_present "${key}"
done
echo "Done."
