#!/bin/bash

# Ubaka MIS & Payroll - System Startup Script
# Starts Fingerprint Service, Backend API, and Frontend App

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo " Starting UbakaMIS & Fingerprint System"
echo "=========================================="

# Kill any previous running instances
pkill -9 -f zkfinger_service.py 2>/dev/null || true
pkill -9 -f "tsx src/server.ts" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
sleep 1

# Start detached so Ctrl+C on the frontend does NOT kill these
start_detached() {
  local log="$1"
  shift
  setsid "$@" >>"$log" 2>&1 < /dev/null &
  echo $!
}

# 1. Start Fingerprint Service (uses native ZKFinger libs via start.sh)
echo "1. Starting Fingerprint Microservice (Port 5001)..."
cd "$ROOT_DIR"
: > "$ROOT_DIR/fingerprint_service.log"
FP_PID=$(start_detached "$ROOT_DIR/fingerprint_service.log" "$ROOT_DIR/fingerprint-service/start.sh")
echo "   Fingerprint Service PID: $FP_PID"

# 2. Start Backend Server
echo "2. Starting Backend Express API (Port 5000)..."
cd "$ROOT_DIR/backend"
: > "$ROOT_DIR/backend.log"
BE_PID=$(start_detached "$ROOT_DIR/backend.log" node_modules/.bin/tsx src/server.ts)
echo "   Backend Server PID: $BE_PID"

# Wait for services to initialize
sleep 4

# 3. Check health
echo ""
echo "=== Service Status Check ==="
FP_HEALTH=$(curl -s --max-time 3 http://127.0.0.1:5001/health || true)
BE_STATUS=$(curl -s --max-time 3 http://127.0.0.1:5000/api/fingerprint/status || true)

if [ -n "$FP_HEALTH" ]; then
  echo "Fingerprint: $FP_HEALTH"
else
  echo "Fingerprint: NOT RUNNING — check fingerprint_service.log"
fi
if [ -n "$BE_STATUS" ]; then
  echo "Backend:     $BE_STATUS"
else
  echo "Backend:     NOT RUNNING — check backend.log"
fi
echo ""

# 4. Start Frontend UI (foreground)
echo "3. Starting Frontend App (Vite Dev Server Port 3000)..."
echo "   Tip: Ctrl+C stops only the frontend; fingerprint + backend keep running."
echo "   Stop them later with: pkill -f zkfinger_service.py; pkill -f 'tsx src/server.ts'"
echo ""
cd "$ROOT_DIR/frontend"
npm run dev:react
