#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-$ROOT/compose.yaml}
BACKUP_DIR=${BACKUP_DIR:-$ROOT/backups}
CONTAINER_NAME=${CONTAINER_NAME:-320_archive-app-1}
VOLUME_NAME=${VOLUME_NAME:-320_archive_data}
READINESS_TIMEOUT_SECONDS=${READINESS_TIMEOUT_SECONDS:-120}
READINESS_INTERVAL_SECONDS=${READINESS_INTERVAL_SECONDS:-2}
IMAGE=${1:-}

case "$IMAGE" in
  *:sha-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;;
  *) echo "usage: $0 <registry/image:sha-<40 hex>> (immutable sha-<40 hex> tag required)" >&2; exit 2 ;;
esac
sha=${IMAGE##*:sha-}
test ${#sha} -eq 40 || { echo "immutable sha-<40 hex> tag required" >&2; exit 2; }
case "$sha" in *[!0-9a-f]*) echo "immutable sha-<40 hex> tag required" >&2; exit 2;; esac

previous_image=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_DIR"
backup_path=$BACKUP_DIR/320-archive-data-$timestamp.tar.gz

start_previous() {
  if test -n "$previous_image"; then
    ARCHIVE_IMAGE=$previous_image docker compose -f "$COMPOSE_FILE" up -d --no-deps app
  else
    docker compose -f "$COMPOSE_FILE" start app || true
  fi
}

docker compose -f "$COMPOSE_FILE" stop app
if ! docker run --rm -v "$VOLUME_NAME:/data:ro" -v "$BACKUP_DIR:/backup" alpine:3.22 \
  tar -C /data -czf "/backup/$(basename "$backup_path")" .; then
  start_previous
  echo "backup failed; previous application restarted" >&2
  exit 1
fi

if ! ARCHIVE_IMAGE=$IMAGE docker compose -f "$COMPOSE_FILE" pull app || \
   ! ARCHIVE_IMAGE=$IMAGE docker compose -f "$COMPOSE_FILE" up -d --no-deps app; then
  start_previous
  echo "deployment failed; rolled back to ${previous_image:-previous compose state}" >&2
  exit 1
fi

deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
while test "$(date +%s)" -le "$deadline"; do
  status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)
  test "$status" = healthy && { echo "deployed $IMAGE; backup: $backup_path"; exit 0; }
  sleep "$READINESS_INTERVAL_SECONDS"
done

start_previous
echo "readiness timed out; rolled back to ${previous_image:-previous compose state}" >&2
exit 1
