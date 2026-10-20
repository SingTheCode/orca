#!/usr/bin/env bash
# Starts a local SpecFlow server for Orca's SpecFlow integration:
#   Postgres (docker, :5436) + SpecFlow Go backend (:8088) with LLM calls routed to devx-proxy (:18888).
# Usage: scripts/specflow-local/up.sh [--seed]
#   --seed  creates the local account and registers devx-proxy as that account's LLM config.
set -euo pipefail

SPECFLOW_DIR="${SPECFLOW_DIR:-$HOME/dev/spec_flow}"
API="http://localhost:${SPECFLOW_PORT:-8088}/api/v1"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/specflow-local"
ACCOUNT_EMAIL="${SPECFLOW_LOCAL_EMAIL:-orca-local@specflow.test}"
ACCOUNT_PASSWORD="${SPECFLOW_LOCAL_PASSWORD:-orca-local-pass-1}"
DEVX_MODEL="${SPECFLOW_DEVX_MODEL:-vertex_ai/claude-sonnet-5-5}"

[ -d "$SPECFLOW_DIR/backend" ] || { echo "SpecFlow repo not found at $SPECFLOW_DIR" >&2; exit 1; }
mkdir -p "$LOG_DIR"

if ! docker info >/dev/null 2>&1; then
  open -a OrbStack 2>/dev/null || true
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
fi
(cd "$SPECFLOW_DIR" && docker compose up -d postgres >/dev/null)
docker update --restart unless-stopped specflow_db >/dev/null
for _ in $(seq 1 30); do docker exec specflow_db pg_isready -U postgres -d postgres >/dev/null 2>&1 && break; sleep 1; done

if ! curl -fs "${API%/api/v1}/health" >/dev/null 2>&1; then
  (cd "$SPECFLOW_DIR/backend" && go build -o "$LOG_DIR/specflow-backend" .)
  (
    cd "$SPECFLOW_DIR/backend"
    set -a; . ./.env; set +a
    PORT="${SPECFLOW_PORT:-8088}" nohup "$LOG_DIR/specflow-backend" >"$LOG_DIR/backend.log" 2>&1 &
    echo $! >"$LOG_DIR/backend.pid"
  )
  for _ in $(seq 1 60); do curl -fs "${API%/api/v1}/health" >/dev/null 2>&1 && break; sleep 1; done
fi
curl -fs "${API%/api/v1}/health" >/dev/null || { echo "backend failed; see $LOG_DIR/backend.log" >&2; exit 1; }
echo "SpecFlow API: $API (log: $LOG_DIR/backend.log)"

if [ "${1:-}" = "--seed" ]; then
  curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ACCOUNT_EMAIL\",\"password\":\"$ACCOUNT_PASSWORD\",\"name\":\"orca-local\"}" >/dev/null || true
  TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ACCOUNT_EMAIL\",\"password\":\"$ACCOUNT_PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
  HAS=$(curl -s "$API/me/llm-configs" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;d=json.load(sys.stdin);d=d if isinstance(d,list) else d.get("configs",[]);print(any(c.get("api_endpoint")=="http://localhost:18888" for c in d))')
  if [ "$HAS" != "True" ]; then
    curl -s -X POST "$API/me/llm-configs" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d "{\"provider\":\"litellm\",\"label\":\"devx-proxy (local)\",\"api_endpoint\":\"http://localhost:18888\",\"api_key\":\"devx-proxy\",\"auth_type\":\"api_key\",\"aws_model_id\":\"$DEVX_MODEL\"}" >/dev/null
  fi
  echo "Seeded account $ACCOUNT_EMAIL with devx-proxy LLM ($DEVX_MODEL)"
fi
