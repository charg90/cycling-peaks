#!/bin/bash
# sync/ngrok-watch.sh
# Runs in background, monitors ngrok URL and updates Vercel when it changes
# Auto-restarts ngrok if it's down

CREDENTIALS="$HOME/.cycling-peaks-credentials"
STATE_FILE="/tmp/ngrok_url_last.txt"
LOG_FILE="/tmp/ngrok-watch.log"

if [ -f "$CREDENTIALS" ]; then
    source "$CREDENTIALS"
else
    echo "ERROR: $CREDENTIALS not found"
    exit 1
fi

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Ensure ngrok is running
ensure_ngrok() {
    if ! curl -s --max-time 2 http://localhost:4041/api/tunnels > /dev/null 2>&1; then
        log "ngrok not running, starting..."
        pkill -f "ngrok" 2>/dev/null || true
        sleep 1
        /tmp/ngrok http 8080 --log=/tmp/ngrok.log > /dev/null 2>&1 &
        sleep 6
    fi
}

# Get current ngrok URL
get_ngrok_url() {
    curl -s http://localhost:4041/api/tunnels 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for t in d.get('tunnels',[]):
    if t.get('proto') == 'https':
        print(t['public_url'])
        break
"
}

# Update Vercel if URL changed
update_vercel() {
    local url="$1"
    curl -s -X POST "https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"key\": \"VITE_API_URL\", \"value\": \"${url}\", \"type\": \"plaintext\", \"target\": \"production\"}" \
        > /dev/null 2>&1
    log "Updated Vercel: VITE_API_URL=$url"
}

# Main loop
log "ngrok-watch started"
LAST_URL=""

while true; do
    ensure_ngrok
    
    URL=$(get_ngrok_url)
    if [ -n "$URL" ] && [ "$URL" != "$LAST_URL" ]; then
        log "URL changed: $LAST_URL -> $URL"
        update_vercel "$URL"
        echo "$URL" > "$STATE_FILE"
        LAST_URL="$URL"
    fi
    
    sleep 30
done
