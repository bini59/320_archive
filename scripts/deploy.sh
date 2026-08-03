#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-$ROOT/compose.yaml}
BACKUP_DIR=${BACKUP_DIR:-$ROOT/backups}
VOLUME_NAME=${VOLUME_NAME:-320_archive_data}
READINESS_TIMEOUT_SECONDS=${READINESS_TIMEOUT_SECONDS:-120}
READINESS_INTERVAL_SECONDS=${READINESS_INTERVAL_SECONDS:-2}
BACKUP_RETENTION_COUNT=${BACKUP_RETENTION_COUNT:-10}
IMAGE=${1:-}

case "$IMAGE" in *:sha-*) ;; *) echo "usage: $0 <registry/image:sha-<40 hex>> (immutable sha-<40 hex> tag required)" >&2; exit 2;; esac
sha=${IMAGE##*:sha-}
test ${#sha} -eq 40 || { echo "immutable sha-<40 hex> tag required" >&2; exit 2; }
case "$sha" in *[!0-9a-f]*) echo "immutable sha-<40 hex> tag required" >&2; exit 2;; esac
case "$BACKUP_RETENTION_COUNT" in ''|*[!0-9]*) echo "BACKUP_RETENTION_COUNT must be a positive integer" >&2; exit 2;; esac
test "$BACKUP_RETENTION_COUNT" -gt 0 || { echo "BACKUP_RETENTION_COUNT must be positive" >&2; exit 2; }

container_id=$(docker compose -f "$COMPOSE_FILE" ps -q app)
previous_image=$(test -n "$container_id" && docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)
stopped=0
completed=0
backup_path=
backup_complete=0

wait_healthy() {
  deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
  while test "$(date +%s)" -le "$deadline"; do
    current_id=$(docker compose -f "$COMPOSE_FILE" ps -q app 2>/dev/null || true)
    status=$(test -n "$current_id" && docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current_id" 2>/dev/null || true)
    test "$status" = healthy && return 0
    sleep "$READINESS_INTERVAL_SECONDS"
  done
  return 1
}

recover() {
  reason=$1
  test "$stopped" = 1 || return 0
  if test -n "$previous_image" && ARCHIVE_IMAGE=$previous_image docker compose -f "$COMPOSE_FILE" up -d --no-deps app && (export ARCHIVE_IMAGE="$previous_image"; wait_healthy); then
    stopped=0
    echo "$reason; rollback succeeded: $previous_image" >&2
    return 0
  fi
  echo "$reason; ROLLBACK FAILED: previous image did not become healthy (${previous_image:-unknown})" >&2
  return 1
}

on_exit() {
  status=$?
  trap - EXIT HUP INT TERM
  if test "$completed" != 1 && test "$stopped" = 1; then recover "deployment interrupted" || status=1; fi
  if test "$backup_complete" != 1 && test -n "$backup_path"; then rm -f "$backup_path" 2>/dev/null || true; fi
  exit "$status"
}
trap on_exit EXIT HUP INT TERM

mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path=$BACKUP_DIR/320-archive-data-$timestamp.tar.gz
stopped=1
if ! docker compose -f "$COMPOSE_FILE" stop app; then
  recover "application stop failed" || true
  exit 1
fi

if ! docker run --rm -v "$VOLUME_NAME:/data:ro" -v "$BACKUP_DIR:/backup" alpine:3.22 \
  tar -C /data -czf "/backup/$(basename "$backup_path")" .; then
  rm -f "$backup_path"
  recover "backup failed" || true
  exit 1
fi
backup_complete=1

find "$BACKUP_DIR" -type f -name '320-archive-data-*.tar.gz' -print | sort -r | \
  awk -v keep="$BACKUP_RETENTION_COUNT" 'NR > keep' | while IFS= read -r old; do rm -f -- "$old"; done

if ! ARCHIVE_IMAGE=$IMAGE docker compose -f "$COMPOSE_FILE" pull app || ! ARCHIVE_IMAGE=$IMAGE docker compose -f "$COMPOSE_FILE" up -d --no-deps app; then
  recover "deployment failed" || true
  exit 1
fi

if ! ARCHIVE_IMAGE=$IMAGE wait_healthy; then
  recover "readiness timed out" || true
  exit 1
fi

stopped=0
completed=1
echo "deployed $IMAGE; backup: $backup_path"
