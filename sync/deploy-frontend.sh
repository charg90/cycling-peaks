#!/bin/bash
# deploy-frontend.sh
# Usage: VERCEL_TOKEN=your_token ./deploy-frontend.sh
#
# This script:
# 1. Starts ngrok on :8080
# 2. Extracts the ngrok URL
# 3. Updates Vercel VITE_API_URL env var
# 4. Triggers a redeploy

set -e

if [ -z "$VERCEL_TOKEN" ]; then
    echo "ERROR: VERCEL_TOKEN environment variable not set"
    echo "Usage: VERCEL_TOKEN=your_token ./deploy-frontend.sh"
    exit 1
fi

VERCEL_PROJECT="prj_qe8JtsXhw6N5MZXQO5mvg0vMTvX4"

echo "=== Cycling Peaks: ngrok + Vercel deploy ==="

# Kill any existing ngrok
pkill -f "ngrok" 2>/dev/null || true
sleep 1

# Start ngrok
echo "[1/4] Starting ngrok on :8080..."
/tmp/ngrok http 8080 --log=/tmp/ngrok.log > /dev/null 2>&1 &
sleep 6

# Get ngrok URL
echo "[2/4] Getting ngrok URL..."
NGROK_URL=$(curl -s http://localhost:4041/api/tunnels 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for t in d.get('tunnels',[]):
    if t.get('proto') == 'https':
        print(t['public_url'])
        break
")

if [ -z "$NGROK_URL" ]; then
    echo "ERROR: Could not get ngrok URL"
    exit 1
fi
echo "  -> $NGROK_URL"

# Update Vercel env var
echo "[3/4] Updating Vercel VITE_API_URL..."
curl -s -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"VITE_API_URL\", \"value\": \"${NGROK_URL}\", \"type\": \"plaintext\", \"target\": \"production\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ->', d.get('key',''), '=', d.get('value',''))" 2>/dev/null

# Trigger redeploy
echo "[4/4] Triggering redeploy..."
curl -s -X POST "https://api.vercel.com/v13/projects/${VERCEL_PROJECT}/deployments" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"gitSource\": {\"type\": \"github\", \"repo\": \"charg90/cycling-peaks\", \"ref\": \"main\"}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  -> Deployment ID:', d.get('id',''), '(check vercel.com/dashboard)')" 2>/dev/null

echo ""
echo "=== DONE ==="
echo "Ngrok URL: $NGROK_URL"
echo "Dashboard: https://vercel.com/dashboard"
