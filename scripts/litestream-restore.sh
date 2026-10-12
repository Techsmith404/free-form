#!/bin/bash
set -euo pipefail

# Free Form Litestream Point-in-Time Restore Script
# Restores the SQLite database from S3-compatible replication storage.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "========================================================="
echo "🔄 Free Form Litestream Disaster Recovery Restore"
echo "========================================================="

# Source environment variables if .env exists
if [[ -f .env ]]; then
    echo "Loading environment variables from .env..."
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env | xargs -d '\n' 2>/dev/null) || true
fi

# Validate required variables
REQUIRED_VARS=("LITESTREAM_BUCKET" "LITESTREAM_ACCESS_KEY_ID" "LITESTREAM_SECRET_ACCESS_KEY")
MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "❌ Error: Required environment variable $var is not set."
        MISSING=1
    fi
done

if [[ "$MISSING" -eq 1 ]]; then
    echo "Please set required Litestream variables in your environment or .env file."
    exit 1
fi

# Detect docker execution mode
if docker info >/dev/null 2>&1; then
    DOCKER_CMD="docker"
else
    echo "Docker requires elevated permissions; using sudo..."
    DOCKER_CMD="sudo docker"
fi

# Ensure data directory exists
mkdir -p "${PROJECT_ROOT}/data"

# Backup existing database if present
DB_FILE="${PROJECT_ROOT}/data/freeform.db"
if [[ -f "${DB_FILE}" ]]; then
    BACKUP_FILE="${PROJECT_ROOT}/data/freeform.db.bak.$(date +%s)"
    echo "⚠️ Existing database detected at ${DB_FILE}."
    echo "📦 Creating pre-restore backup at ${BACKUP_FILE}..."
    cp "${DB_FILE}" "${BACKUP_FILE}"
    # Backup WAL and SHM if present
    [[ -f "${DB_FILE}-wal" ]] && cp "${DB_FILE}-wal" "${BACKUP_FILE}-wal" || true
    [[ -f "${DB_FILE}-shm" ]] && cp "${DB_FILE}-shm" "${BACKUP_FILE}-shm" || true
    # Remove old WAL/SHM to avoid stale state after restore
    rm -f "${DB_FILE}-wal" "${DB_FILE}-shm"
fi

TARGET_DB="/data/freeform.db"
RESTORE_ARGS=()

if [[ -n "${RESTORE_TIMESTAMP:-}" ]]; then
    echo "Restoring to specific timestamp: ${RESTORE_TIMESTAMP}"
    RESTORE_ARGS+=("-timestamp" "${RESTORE_TIMESTAMP}")
fi

echo "🚀 Running Litestream restore container..."
$DOCKER_CMD run --rm \
    -v "${PROJECT_ROOT}/data:/data" \
    -v "${PROJECT_ROOT}/litestream.yml:/etc/litestream.yml:ro" \
    -e LITESTREAM_BUCKET="${LITESTREAM_BUCKET}" \
    -e LITESTREAM_PATH="${LITESTREAM_PATH:-freeform-db}" \
    -e LITESTREAM_ENDPOINT="${LITESTREAM_ENDPOINT:-}" \
    -e LITESTREAM_REGION="${LITESTREAM_REGION:-us-east-1}" \
    -e LITESTREAM_ACCESS_KEY_ID="${LITESTREAM_ACCESS_KEY_ID}" \
    -e LITESTREAM_SECRET_ACCESS_KEY="${LITESTREAM_SECRET_ACCESS_KEY}" \
    litestream/litestream:0.3.13 \
    restore -config /etc/litestream.yml "${RESTORE_ARGS[@]}" "${TARGET_DB}"

echo "========================================================="
echo "✅ Restore completed successfully!"
echo "Database restored to: ${DB_FILE}"
echo "You can now safely start the Free Form service:"
echo "  docker compose up -d"
echo "========================================================="
