
# ── Absolute path to the project root ─────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Resolve node binary ───────────────────────────────────────────────────────
# Cron does not load shell profiles so nvm is not available.
# We hardcode the nvm node path; update this if you switch node versions.
NODE_BIN="/home/emumba/.nvm/versions/node/v22.18.0/bin/node"

# ── Log file for cron output (separate from the app's own logger) ─────────────
CRON_LOG="$PROJECT_DIR/logs/cron.log"

# ── Move into project root so dotenv finds .env and paths resolve correctly ───
cd "$PROJECT_DIR" || exit 1

# ── Run the sync ──────────────────────────────────────────────────────────────
echo "[$( date -u +"%Y-%m-%dT%H:%M:%SZ" )] ▶ Starting sync" >> "$CRON_LOG"

"$NODE_BIN" "$PROJECT_DIR/index.js" "$@" >> "$CRON_LOG" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$( date -u +"%Y-%m-%dT%H:%M:%SZ" )] ✅ Sync finished successfully" >> "$CRON_LOG"
else
  echo "[$( date -u +"%Y-%m-%dT%H:%M:%SZ" )] ❌ Sync FAILED with exit code $EXIT_CODE" >> "$CRON_LOG"
fi

exit $EXIT_CODE
