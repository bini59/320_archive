#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-$ROOT/compose.yaml}
COMPOSE_ENV_FILE=${COMPOSE_ENV_FILE:-}
BACKUP_DIR=${BACKUP_DIR:-$ROOT/backups}
VOLUME_NAME=${VOLUME_NAME:-320_archive_data}
READINESS_TIMEOUT_SECONDS=${READINESS_TIMEOUT_SECONDS:-120}
READINESS_INTERVAL_SECONDS=${READINESS_INTERVAL_SECONDS:-2}
BACKUP_RETENTION_COUNT=${BACKUP_RETENTION_COUNT:-10}
IMAGE_RETENTION_COUNT=${IMAGE_RETENTION_COUNT:-3}
IMAGE=${1:-}

compose() {
  if test -n "$COMPOSE_ENV_FILE"; then
    test -f "$COMPOSE_ENV_FILE" || {
      echo "compose env file not found: $COMPOSE_ENV_FILE" >&2
      return 1
    }
    docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

case "$IMAGE" in *:sha-*) ;; *) echo "usage: $0 <registry/image:sha-<40 hex>> (immutable sha-<40 hex> tag required)" >&2; exit 2;; esac
sha=${IMAGE##*:sha-}
test ${#sha} -eq 40 || { echo "immutable sha-<40 hex> tag required" >&2; exit 2; }
case "$sha" in *[!0-9a-f]*) echo "immutable sha-<40 hex> tag required" >&2; exit 2;; esac
case "$BACKUP_RETENTION_COUNT" in ''|*[!0-9]*) echo "BACKUP_RETENTION_COUNT must be a positive integer" >&2; exit 2;; esac
test "$BACKUP_RETENTION_COUNT" -gt 0 || { echo "BACKUP_RETENTION_COUNT must be positive" >&2; exit 2; }
case "$IMAGE_RETENTION_COUNT" in ''|*[!0-9]*) echo "IMAGE_RETENTION_COUNT must be a positive integer" >&2; exit 2;; esac
test "$IMAGE_RETENTION_COUNT" -gt 0 || { echo "IMAGE_RETENTION_COUNT must be positive" >&2; exit 2; }

container_id=$(compose ps -q app)
previous_image=$(test -n "$container_id" && docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)
stopped=0
completed=0
backup_path=
backup_complete=0

wait_healthy() {
  deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
  while test "$(date +%s)" -le "$deadline"; do
    current_id=$(compose ps -q app 2>/dev/null || true)
    status=$(test -n "$current_id" && docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current_id" 2>/dev/null || true)
    test "$status" = healthy && return 0
    sleep "$READINESS_INTERVAL_SECONDS"
  done
  return 1
}

recover() {
  reason=$1
  test "$stopped" = 1 || return 0
  if test -n "$previous_image" && ARCHIVE_IMAGE=$previous_image compose up -d --no-deps app && (export ARCHIVE_IMAGE="$previous_image"; wait_healthy); then
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
if ! compose stop app; then
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

if ! ARCHIVE_IMAGE=$IMAGE compose pull app || ! ARCHIVE_IMAGE=$IMAGE compose up -d --no-deps app; then
  recover "deployment failed" || true
  exit 1
fi

if ! ARCHIVE_IMAGE=$IMAGE wait_healthy; then
  recover "readiness timed out" || true
  exit 1
fi

stopped=0
completed=1

image_repository=${IMAGE%:*}
image_tags=$(docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}' "$image_repository" 2>/dev/null | awk -v repository="$image_repository" '$1 ~ ("^" repository ":sha-[0-9a-f]+$") { print $1 "\t" $2 " " $3 " " $4 " " $5 " " $6 }' | sort -k2r | cut -f1)
keep_images=$(printf '%s\n' "$IMAGE" $image_tags | awk 'NF && !seen[$0]++' | awk -v keep="$IMAGE_RETENTION_COUNT" 'NR <= keep')
if test -n "$previous_image"; then
  printf '%s\n' "$keep_images" | grep -F -x "$previous_image" >/dev/null 2>&1 || keep_images=$(printf '%s\n' "$keep_images" "$previous_image")
fi
cleanup_failures=0
for image in $image_tags; do
  if ! printf '%s\n' "$keep_images" | grep -F -x "$image" >/dev/null 2>&1; then
    if ! docker image rm "$image" >/dev/null 2>&1; then
      cleanup_failures=$((cleanup_failures + 1))
    fi
  fi
done
if test "$cleanup_failures" -gt 0; then
  echo "warning: failed to remove $cleanup_failures old image(s)" >&2
fi

echo "deployed $IMAGE; backup: $backup_path; image retention: $IMAGE_RETENTION_COUNT"
