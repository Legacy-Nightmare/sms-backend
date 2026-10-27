#!/usr/bin/env bash
# Restores a pg-backup.sh dump into this host's postgres container.
# Usage (run from /opt/sms, e.g. on the client's VPS during the EC2->VPS move):
#   ./pg-restore.sh backups/sms-pg-20261027-120000.sql.gz
#
# Destructive: drops and recreates the target database first, so the dump
# restores onto a clean schema instead of erroring on existing tables.
set -euo pipefail

cd "$(dirname "$0")"
DUMP_FILE="${1:?Usage: ./pg-restore.sh <path-to-dump.sql.gz>}"

set -a
source .env
set +a

echo "This will DROP and recreate database '$DB_DATABASE' on this host. Ctrl-C to abort."
sleep 5

docker compose exec -T postgres psql -U "$DB_USERNAME" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$DB_DATABASE\";" \
  -c "CREATE DATABASE \"$DB_DATABASE\" OWNER \"$DB_USERNAME\";"

gunzip -c "$DUMP_FILE" | docker compose exec -T postgres psql -U "$DB_USERNAME" -d "$DB_DATABASE"

echo "Restore complete from $DUMP_FILE"
