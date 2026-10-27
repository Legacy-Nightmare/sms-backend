
#!/usr/bin/env bash
# Cold backup of RustFS /data.
# Run from /opt/sms or the deploy directory containing docker-compose.yml.
# Usage: ./rustfs-backup.sh [output-directory]

set -euo pipefail

cd "$(dirname "$0")"

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(realpath "$OUT_DIR")"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="rustfs-${STAMP}.tar.gz"

# Prevent writes while creating a filesystem-level backup.
docker compose stop rustfs

cleanup() {
  docker compose up -d rustfs >/dev/null || true
}
trap cleanup EXIT

# The container must still exist after being stopped.
docker run --rm \
  --volumes-from sms-rustfs:ro \
  -v "$OUT_DIR:/backup" \
  alpine:3.20 \
  tar czf "/backup/$OUT_FILE" -C /data .

test -s "$OUT_DIR/$OUT_FILE"
echo "RustFS backup created: $OUT_DIR/$OUT_FILE"
