#!/usr/bin/env bash
# Stops the local SpecFlow backend started by up.sh and the Postgres container (data volume is kept).
set -euo pipefail
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/specflow-local"
if [ -f "$LOG_DIR/backend.pid" ]; then
  kill "$(cat "$LOG_DIR/backend.pid")" 2>/dev/null || true
  rm -f "$LOG_DIR/backend.pid"
fi
docker stop specflow_db >/dev/null 2>&1 || true
echo "SpecFlow local server stopped"
