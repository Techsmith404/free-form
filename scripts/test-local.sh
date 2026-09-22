#!/bin/bash
set -euo pipefail

# Ensure we run from project root
cd "$(dirname "$0")/.."

echo "========================================="
echo "🧪 Running Free Form Local Docker Test..."
echo "========================================="

# 1. Determine whether docker requires sudo
if docker info >/dev/null 2>&1; then
    DOCKER_CMD="docker"
else
    echo "Docker requires elevated permissions; using sudo..."
    DOCKER_CMD="sudo docker"
fi

# 2. Ensure data directory structure exists
echo "Checking persistent data structure..."
mkdir -p ./data/uploads

# 3. Clean up any existing running container
echo "Bringing down any existing Free Form containers..."
$DOCKER_CMD compose down --remove-orphans 2>/dev/null || true

# 4. Build and start container in detached mode
echo "Building and starting Free Form container..."
$DOCKER_CMD compose up -d --build --remove-orphans

# 5. Wait for web server to become healthy
echo "Waiting for Free Form server to become healthy..."
MAX_RETRIES=45
COUNT=0
until curl -s -f http://127.0.0.1:3000/api/health > /dev/null 2>&1; do
    sleep 1
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo "❌ Health check timed out after ${MAX_RETRIES} seconds."
        echo "Displaying container logs for debugging:"
        $DOCKER_CMD logs free-form --tail 40
        exit 1
    fi
done

echo ""
echo "========================================================="
echo "✅ FREE FORM CONTAINER RUNNING ✅"
echo "---------------------------------------------------------"
echo "📝 Web App & PWA:    http://localhost:3000"
echo "🔌 Health Endpoint:  http://localhost:3000/api/health"
echo "📁 Data Directory:   $(pwd)/data"
echo "========================================================="
echo ""
echo "🔍 Recent Container Logs:"
sleep 1
$DOCKER_CMD logs free-form --tail 25
