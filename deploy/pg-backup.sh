#!/usr/bin/env bash
# Dumps the Postgres container's database to a timestamped, gzipped file.
# Run from /opt/sms on the EC2 (or later VPS) host:
#   ./pg-backup.sh                 # writes to ./backups/
#   ./pg-backup.sh /some/other/dir # writes there instead
#
# To move to the client's VPS later: copy the newest file in ./backups/ over
# and run pg-restore.sh against the VPS's postgres container. See
# minio-backup.sh for the matching step for uploaded files.
set -euo pipefail

cd "$(dirname "$0")"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

set -a
source .env
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/sms-pg-${STAMP}.sql.gz"

docker compose exec -T postgres pg_dump -U "$DB_USERNAME" -d "$DB_DATABASE" | gzip > "$OUT_FILE"

echo "Backup written to $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
