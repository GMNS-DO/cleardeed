#!/usr/bin/env bash
# infra/supabase/backup.sh — Daily Postgres backup to local archive (A.4.3)
#
# Runs `pg_dump` against the production Supabase DB, gzips, and stores
# in ./backups/ with a 7-day retention. After 7 days, the oldest
# backup is deleted.
#
# Setup:
#   1. Install Postgres client tools: `brew install libpq` and add
#      /opt/homebrew/opt/libpq/bin to PATH (or use `apt install postgresql-client`).
#   2. Set DATABASE_URL in your environment (the direct-connection URL
#      from Supabase dashboard → Project Settings → Database).
#   3. Add to cron (daily at 03:00 IST):
#      0 3 * * * /Users/you/cleardeed/infra/supabase/backup.sh >> /tmp/cleardeed-backup.log 2>&1
#
# This is the launch-week backup baseline. Once Supabase Pro PITR
# is enabled, this script becomes the second-line defense for
# explicit "I want a snapshot I can hand to support" cases.
#
# Note: Prerequisite for cron is a `DATABASE_URL` env var that the
# cron daemon can read. On macOS, the simplest way is to set it in
# `~/.zshrc` (cron inherits a limited PATH but does inherit env
# vars if launched with `env -i` workaround or with a wrapper).

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] DATABASE_URL is not set — refusing to run" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../../backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y-%m-%d-%H%M)
FILENAME="cleardeed-${TIMESTAMP}.sql.gz"
TARGET="${BACKUP_DIR}/${FILENAME}"

# Use a 30-minute timeout. The Supabase direct-connection pool
# can hang during daily maintenance windows; timeout is the
# friendly way to bail rather than wait forever.
echo "[backup] starting pg_dump at $(date -Iseconds)"
echo "[backup] target: ${TARGET}"

if timeout 1800 pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-privileges \
  --schema=public \
  | gzip > "${TARGET}"; then
  SIZE=$(du -h "${TARGET}" | cut -f1)
  echo "[backup] ok — ${SIZE} written to ${TARGET}"

  # Retention: delete backups older than 7 days
  DELETED=$(find "${BACKUP_DIR}" -name "cleardeed-*.sql.gz" -mtime +7 -delete -print | wc -l | tr -d ' ')
  echo "[backup] retention: deleted ${DELETED} backup(s) older than 7 days"

  # List current backups
  echo "[backup] current backups:"
  ls -lh "${BACKUP_DIR}/" | tail -n +2
else
  echo "[backup] FAILED — pg_dump exited non-zero. Check connectivity and credentials." >&2
  exit 1
fi
