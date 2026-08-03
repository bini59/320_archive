#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail() { echo "not ok - $1" >&2; exit 1; }
assert_log() { grep -F "$1" "$TMP/docker.log" >/dev/null || fail "missing docker call: $1"; }

mkdir -p "$TMP/bin" "$TMP/backups"
cat >"$TMP/bin/docker" <<'FAKE'
#!/bin/sh
set -eu
echo "ARCHIVE_IMAGE=${ARCHIVE_IMAGE:-} $*" >>"$DOCKER_LOG"
case "$*" in
  "compose -f "*" ps -q app") echo "container-id" ;;
  "inspect --format {{.Config.Image}} container-id") echo "ghcr.io/bini59/320_archive:sha-old" ;;
  "inspect --format {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}} container-id")
    count_file=${HEALTH_COUNT_FILE}
    count=0; test ! -f "$count_file" || count=$(cat "$count_file")
    count=$((count + 1)); echo "$count" >"$count_file"
    if test "${FORCE_ROLLBACK_UNHEALTHY:-0}" = 1; then echo unhealthy
    elif test "${FORCE_UNHEALTHY:-0}" = 1 && test "${ARCHIVE_IMAGE:-}" != "ghcr.io/bini59/320_archive:sha-old"; then echo unhealthy
    else echo healthy; fi
    ;;
  "run --rm "*"tar "*) test "${FAIL_BACKUP:-0}" != 1 ;;
esac
FAKE
chmod +x "$TMP/bin/docker"

export PATH="$TMP/bin:$PATH" DOCKER_LOG="$TMP/docker.log" HEALTH_COUNT_FILE="$TMP/health-count"
export BACKUP_DIR="$TMP/backups" READINESS_TIMEOUT_SECONDS=1 READINESS_INTERVAL_SECONDS=0
export BACKUP_RETENTION_COUNT=2

if "$ROOT/scripts/deploy.sh" ghcr.io/bini59/320_archive:latest 2>"$TMP/error"; then
  fail "mutable image was accepted"
fi
grep -F "immutable sha-<40 hex>" "$TMP/error" >/dev/null || fail "immutable image error is unclear"

: >"$TMP/docker.log"
IMAGE=ghcr.io/bini59/320_archive:sha-0123456789abcdef0123456789abcdef01234567
"$ROOT/scripts/deploy.sh" "$IMAGE"
assert_log "compose -f $ROOT/compose.yaml stop app"
assert_log "run --rm -v 320_archive_data:/data:ro"
assert_log "compose -f $ROOT/compose.yaml pull app"
assert_log "compose -f $ROOT/compose.yaml up -d --no-deps app"
grep -E "tar -C /data -czf /backup/320-archive-data-[0-9]{8}T[0-9]{6}Z.tar.gz" "$TMP/docker.log" >/dev/null || fail "timestamped backup was not requested"

: >"$TMP/docker.log"; rm -f "$TMP/health-count"
if FORCE_UNHEALTHY=1 "$ROOT/scripts/deploy.sh" "$IMAGE"; then
  fail "unhealthy rollout succeeded"
fi
assert_log "compose -f $ROOT/compose.yaml up -d --no-deps app"
grep -F "ARCHIVE_IMAGE=ghcr.io/bini59/320_archive:sha-old" "$TMP/docker.log" >/dev/null || fail "prior image was not used for rollback"
grep -F "rollback succeeded" "$TMP/error" >/dev/null 2>&1 || true

: >"$TMP/docker.log"; rm -f "$TMP/health-count"
if FORCE_UNHEALTHY=1 FORCE_ROLLBACK_UNHEALTHY=1 "$ROOT/scripts/deploy.sh" "$IMAGE" 2>"$TMP/error"; then fail "failed rollback succeeded"; fi
grep -F "ROLLBACK FAILED" "$TMP/error" >/dev/null || fail "rollback health failure was not explicit"

: >"$TMP/docker.log"; rm -f "$TMP/health-count"
if FAIL_BACKUP=1 "$ROOT/scripts/deploy.sh" "$IMAGE" 2>"$TMP/error"; then fail "failed backup succeeded"; fi
grep -F "ARCHIVE_IMAGE=ghcr.io/bini59/320_archive:sha-old" "$TMP/docker.log" >/dev/null || fail "backup failure did not recover previous app"
test -z "$(find "$TMP/backups" -name '320-archive-data-*.tar.gz' -print -quit)" || fail "failed backup left a partial archive"

touch "$TMP/backups/320-archive-data-20200101T000000Z.tar.gz" "$TMP/backups/320-archive-data-20200102T000000Z.tar.gz" "$TMP/backups/320-archive-data-20200103T000000Z.tar.gz"
FORCE_UNHEALTHY=0 "$ROOT/scripts/deploy.sh" "$IMAGE" >/dev/null
test "$(find "$TMP/backups" -name '320-archive-data-*.tar.gz' | wc -l)" -le 2 || fail "backup retention was not enforced"

echo "ok - deployment contract"
