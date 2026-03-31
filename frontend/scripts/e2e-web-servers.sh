#!/usr/bin/env bash
# Start SQLite-backed API + Vite preview for Playwright (expects frontend/dist to exist).
# If something already serves /api/ready on HTTP_PORT (default 8080), reuse it — do not
# start a second API or kill the existing process on exit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/lib.sh"

export HTTP_PORT="${HTTP_PORT:-8080}"
export DB_DRIVER=sqlite3
unset DB_DSN

API_PID=""
DATA_DIR=""
REUSE_API=0

cleanup() {
  if (( REUSE_API == 1 )); then
    [[ -n "${DATA_DIR:-}" ]] && rm -rf "$DATA_DIR"
    return 0
  fi
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  [[ -n "${DATA_DIR:-}" ]] && rm -rf "$DATA_DIR"
}
trap cleanup EXIT INT TERM

if [[ ! -d "$FRONTEND/dist" ]]; then
  echo "e2e-web-servers: run 'bun run build' in frontend first (dist/ missing)." >&2
  exit 1
fi
# Preview always serves dist/; after UI changes run `bun run build` so e2e matches current source.

if ! http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready" && ! http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/health"; then
  if tcp_port_connects_localhost "$HTTP_PORT"; then
    echo "e2e-web-servers: port ${HTTP_PORT} is in use but does not respond like this API (/api/ready). Free it or set HTTP_PORT." >&2
    exit 1
  fi
fi

if http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready" || http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/health"; then
  echo "e2e-web-servers: reusing existing API on :${HTTP_PORT}" >&2
  REUSE_API=1
else
  DATA_DIR="$(mktemp -d)"
  export DATA_DIR
  (cd "$ROOT/backend" && go run ./cmd/api) &
  API_PID=$!

  ready=0
  for _ in $(seq 1 120); do
    if http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready"; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "e2e-web-servers: API did not become ready on :${HTTP_PORT} in time." >&2
    exit 1
  fi
fi

cd "$FRONTEND"
export VITE_API_BASE="http://127.0.0.1:${HTTP_PORT}"
exec bun ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173
