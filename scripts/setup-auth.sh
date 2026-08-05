#!/bin/sh
set -eu

umask 077

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
AUTH_ROOT=${AUTH_ROOT:-$ROOT/../321_auth}
AUTH_COMPOSE_FILE=${AUTH_COMPOSE_FILE:-$AUTH_ROOT/docker-compose.yml}
ARCHIVE_ENV_FILE=${ARCHIVE_ENV_FILE:-$ROOT/.env}
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-/home/ubuntu/actions-runner-320/.env}
AUTH_ORIGIN=${AUTH_ORIGIN:-https://auth.bini59.dev}
CLIENT_ID=${CLIENT_ID:-archive}
CLIENT_NAME=${CLIENT_NAME:-320 Archive}
ARCHIVE_ORIGIN=${ARCHIVE_ORIGIN:-https://archive.bini59.dev}

test -f "$AUTH_COMPOSE_FILE" || {
  echo "auth compose file not found: $AUTH_COMPOSE_FILE" >&2
  exit 1
}
command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

read_env_value() {
  key=$1
  test -f "$ARCHIVE_ENV_FILE" || return 0
  awk -F= -v key="$key" '$1 == key { value=substr($0, index($0, "=") + 1); gsub(/^"|"$/, "", value); print value; exit }' "$ARCHIVE_ENV_FILE"
}

APP_SECRET=$(read_env_value APP_SECRET || true)
if test -z "$APP_SECRET"; then
  APP_SECRET=$(openssl rand -hex 32)
fi

mkdir -p "$(dirname -- "$ARCHIVE_ENV_FILE")"
staged_env=$(mktemp "$(dirname -- "$ARCHIVE_ENV_FILE")/.env.auth.XXXXXX")
staged_production_env=
cleanup() {
  rm -f "$staged_env"
  test -z "$staged_production_env" || rm -f "$staged_production_env"
}
trap cleanup EXIT HUP INT TERM

upsert_env() {
  key=$1
  value=$2
  file=$3
  if test -f "$file"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { found = 0 }
      $0 ~ "^" key "=" { print key "=" value; found = 1; next }
      { print }
      END { if (!found) print key "=" value }
    ' "$file" > "$file.next"
    mv "$file.next" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

if test -f "$ARCHIVE_ENV_FILE"; then
  cp "$ARCHIVE_ENV_FILE" "$staged_env"
fi
upsert_env AUTH_ORIGIN "$AUTH_ORIGIN" "$staged_env"
upsert_env CLIENT_ID "$CLIENT_ID" "$staged_env"
upsert_env APP_SECRET "$APP_SECRET" "$staged_env"

if test "$PRODUCTION_ENV_FILE" != "$ARCHIVE_ENV_FILE" && test -f "$PRODUCTION_ENV_FILE"; then
  staged_production_env=$(mktemp "$(dirname -- "$PRODUCTION_ENV_FILE")/.env.auth.XXXXXX")
  cp "$PRODUCTION_ENV_FILE" "$staged_production_env"
  upsert_env AUTH_ORIGIN "$AUTH_ORIGIN" "$staged_production_env"
  upsert_env CLIENT_ID "$CLIENT_ID" "$staged_production_env"
  upsert_env APP_SECRET "$APP_SECRET" "$staged_production_env"
fi

# seed-client stores only a hash in auth DB; the plaintext secret stays in the
# staged archive env file and is never printed by this script.
docker compose -f "$AUTH_COMPOSE_FILE" exec -T auth-app \
  node /app/apps/api/dist/db/seed-client.js \
  "$CLIENT_ID" "$CLIENT_NAME" "$APP_SECRET" \
  "$ARCHIVE_ORIGIN" "$ARCHIVE_ORIGIN/" true

mv "$staged_env" "$ARCHIVE_ENV_FILE"
chmod 600 "$ARCHIVE_ENV_FILE"
if test -n "$staged_production_env"; then
  mv "$staged_production_env" "$PRODUCTION_ENV_FILE"
  chmod 600 "$PRODUCTION_ENV_FILE"
fi
trap - EXIT HUP INT TERM

echo "configured $CLIENT_ID auth client and archive environment"
