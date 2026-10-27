#!/usr/bin/env bash
# Restores a minio-backup.sh tarball into this host's minio data volume.
# Usage (run from /opt/sms, e.g. on the client's VPS during the EC2->VPS move):
#   ./minio-restore.sh backups/minio-20261027-120000.tar.gz
#
# Destructive: wipes the existing data directory first (including whatever
# empty bucket minio-init already created on this host) so the restore lands
# on a clean slate instead of merging with it.
set -euo pipefail

cd "$(dirname "$0")"
ARCHIVE="${1:?Usage: ./minio-restore.sh <path-to-minio-backup.tar.gz>}"
ARCHIVE="$(realpath "$ARCHIVE")"

echo "This will WIPE all MinIO data on this host and replace it from $ARCHIVE. Ctrl-C to abort."
sleep 5

docker compose stop minio

# --volumes-from the (stopped, but not removed) sms-minio container reuses
# its exact /data mount — alpine is used instead of the minio image itself
# because minio/minio doesn't bundle tar.
docker run --rm \
  --volumes-from sms-minio \
  -v "$ARCHIVE:/host-backup/archive.tar.gz:ro" \
  alpine sh -c "rm -rf /data/* /data/.minio.sys && tar xzf /host-backup/archive.tar.gz -C /data"

docker compose up -d --wait minio

echo "Restore complete from $ARCHIVE"
