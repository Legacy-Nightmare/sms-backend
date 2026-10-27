#!/usr/bin/env bash
# Tars up MinIO's entire data directory (uploaded files + its internal
# .minio.sys metadata, which is what remembers the bucket and its anonymous-
# read policy) to a timestamped, gzipped file.
# Run from /opt/sms on the EC2 (or later VPS) host:
#   ./minio-backup.sh                 # writes to ./backups/
#   ./minio-backup.sh /some/other/dir # writes there instead
#
# To move to the client's VPS later: copy the newest file in ./backups/ over
# and run minio-restore.sh against the VPS's minio container. See
# pg-backup.sh for the matching step for the database.
set -euo pipefail

cd "$(dirname "$0")"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="minio-${STAMP}.tar.gz"

# --volumes-from the running sms-minio container reuses its exact /data
# mount without needing to know the real docker volume name (which compose
# prefixes with the project name). alpine is used instead of the minio image
# itself because minio/minio doesn't bundle tar.
docker run --rm \
  --volumes-from sms-minio \
  -v "$(realpath "$OUT_DIR"):/host-backup" \
  alpine tar czf "/host-backup/$OUT_FILE" -C /data .

echo "Backup written to $OUT_DIR/$OUT_FILE ($(du -h "$OUT_DIR/$OUT_FILE" | cut -f1))"
