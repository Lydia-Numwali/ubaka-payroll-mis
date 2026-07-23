#!/bin/bash

# Ubaka MIS & Payroll - System Startup Script
# Starts Fingerprint Service, Backend API, and Frontend App

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo " Starting UbakaMIS & Fingerprint System"
echo "=========================================="

# Kill any previous running instances
pkill -9 -f zkfinger_service.py 2>/dev/null
pkill -9 -f "tsx src/server.ts" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null

# 1. Start Fingerprint Service (uses native ZKFinger libs via start.sh)
echo "1. Starting Fingerprint Microservice (Port 5001)..."
cd "$ROOT_DIR"
nohup "$ROOT_DIR/fingerprint-service/start.sh" > "$ROOT_DIR/fingerprint_service.log" 2>&1 &
FP_PID=$!
echo "   Fingerprint Service PID: $FP_PID"

# 2. Start Backend Server
echo "2. Starting Backend Express API (Port 5000)..."
cd "$ROOT_DIR/backend"
nohup node_modules/.bin/tsx src/server.ts > "$ROOT_DIR/backend.log" 2>&1 &
BE_PID=$!
echo "   Backend Server PID: $BE_PID"

# Wait for services to initialize
sleep 3

# 3. Check health
echo ""
echo "=== Service Status Check ==="
curl -s http://127.0.0.1:5001/health || echo "Fingerprint Service starting..."
echo ""
curl -s http://127.0.0.1:5000/api/fingerprint/status || echo "Backend API starting..."
echo ""

# 4. Start Frontend UI
echo "3. Starting Frontend App (Vite Dev Server Port 3000)..."
cd "$ROOT_DIR/frontend"
npm run dev:react

