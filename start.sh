#!/bin/bash
# ── Kinolu · One-command startup ──
# Usage:  ./start.sh
# Opens:  http://localhost:3000  (the only URL you need)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill any leftover processes on our ports
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 0.5

echo "🚀 Starting Kinolu..."

# 1) Start Python backend (API only, no UI)
cd "$ROOT"
KINOLU_STABLE_ONLY=1 python3 -m uvicorn backend.app:app \
  --host 127.0.0.1 --port 8000 \
  --log-level warning &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "✓ Backend ready (PID $BACKEND_PID)"
    break
  fi
  sleep 1
done

# 2) Start Next.js frontend (now in root)
cd "$ROOT"
npx next dev -p 3000 &
FRONTEND_PID=$!
sleep 2
echo ""
echo "═══════════════════════════════════════"
echo "  Kinolu is running at:"
echo "  👉  http://localhost:3000"
echo "═══════════════════════════════════════"
echo ""

# Clean up on exit
cleanup() {
  echo "Shutting down..."
  kill $FRONTEND_PID 2>/dev/null
  kill $BACKEND_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Keep alive
wait
