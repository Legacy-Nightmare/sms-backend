
#!/usr/bin/env bash
# Restore a RustFS data-directory backup into this host's RustFS volume.
#
# Usage:
#   ./rustfs-restore.sh backups/rustfs-20261027T120000Z.tar.gz
#
# IMPORTANT:
# - This operation REPLACES existing RustFS data.
# - Stop all application writers before restoring.
# - Test the backup and restore process in staging before production.
# - The archive must come from a compatible RustFS data-directory backup.

set -Eeuo pipefail

cd "$(dirname "$0")"

ARCHIVE="${1:?Usage: ./rustfs-restore.sh <path-to-rustfs-backup.tar.gz>}"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "ERROR: Backup archive not found: $ARCHIVE" >&2
  exit 1
fi

ARCHIVE="$(realpath "$ARCHIVE")"

if [[ ! -s "$ARCHIVE" ]]; then
  echo "ERROR: Backup archive is empty: $ARCHIVE" >&2
  exit 1
fi

if ! tar -tzf "$ARCHIVE" >/dev/null; then
  echo "ERROR: Backup archive is invalid or corrupted: $ARCHIVE" >&2
  exit 1
fi

# Verify that the expected Compose service exists.
if ! docker compose config --services | grep -Fxq "rustfs"; then
  echo "ERROR: Compose service 'rustfs' was not found." >&2
  exit 1
fi

# This script expects the existing container name from the current setup.
CONTAINER="sms-rustfs"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Container '$CONTAINER' does not exist." >&2
  echo "Start the RustFS Compose service once and verify its container_name." >&2
  exit 1
fi

echo
echo "WARNING: This will REPLACE the RustFS data on this server."
echo "Backup: $ARCHIVE"
echo "Container: $CONTAINER"
echo
read -r -p "Type RESTORE to continue: " CONFIRM

if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

RUSTFS_STOPPED=0

restart_rustfs() {
  if [[ "$RUSTFS_STOPPED" -eq 1 ]]; then
    echo "Starting RustFS..."
    docker compose up -d rustfs || true
  fi
}

trap restart_rustfs EXIT

echo "Stopping backend and RustFS..."
docker compose stop backend
docker compose stop rustfs
RUSTFS_STOPPED=1

# The container must remain present so --volumes-from can reuse its /data mount.
# Do not run docker compose down or remove the container during this operation.
echo "Restoring RustFS data..."

docker run --rm \
  --volumes-from "${CONTAINER}" \
  -v "$(dirname "$ARCHIVE"):/host-backup:ro" \
  alpine:3.20 \
  sh -ec '
    archive="/host-backup/'"$(basename "$ARCHIVE")"'"
    test -s "$archive"

    # Clear the data directory contents, including hidden files,
    # before extracting the verified backup.
    find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

    tar xzf "$archive" -C /data
  '

echo "Starting RustFS..."
docker compose up -d --wait rustfs
RUSTFS_STOPPED=0

echo "Starting backend..."
docker compose up -d backend

echo
echo "Restore command completed."
echo "Verify RustFS logs, bucket contents, and application file access:"
echo "  docker compose logs --tail=100 rustfs"
echo "  docker compose logs --tail=100 backend"
