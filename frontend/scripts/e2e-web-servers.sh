#!/usr/bin/env bash
# Start SQLite-backed API + Vite preview for Playwright (expects frontend/dist to exist).
# Locally: if something already serves /api/ready on HTTP_PORT (default 8080), reuse it.
# In CI (CI=true): never reuse — always start a dedicated API so a stray dev server cannot
# poison E2E. Set E2E_FORBID_API_REUSE=1 for the same behaviour locally.
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
# CI already builds with VITE_AUTH_REQUIRED=false and VITE_API_BASE= (see web-build workflow).
# Locally, dist/ often comes from a dev build (auth on, custom API); rebuild so e2e matches CI.
if [[ "${CI:-}" != "true" ]] && [[ "${SKIP_E2E_GUEST_BUILD:-}" != "1" ]]; then
  (cd "$FRONTEND" && VITE_AUTH_REQUIRED=false VITE_API_BASE= bun run build)
fi
# Preview always serves dist/; set SKIP_E2E_GUEST_BUILD=1 to skip this rebuild when iterating.

forbid_reuse=0
if [[ "${CI:-}" == "true" ]] || [[ "${E2E_FORBID_API_REUSE:-}" == "1" ]]; then
  forbid_reuse=1
fi

if (( forbid_reuse == 1 )); then
  if http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready" || http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/health"; then
    echo "e2e-web-servers: refusing to reuse an existing API on :${HTTP_PORT} (CI or E2E_FORBID_API_REUSE=1). Stop that server or set HTTP_PORT to a free port." >&2
    exit 1
  fi
  if tcp_port_connects_localhost "$HTTP_PORT"; then
    echo "e2e-web-servers: port ${HTTP_PORT} is in use (CI / E2E_FORBID_API_REUSE requires a free port). Free it or set HTTP_PORT." >&2
    exit 1
  fi
fi

if ! http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready" && ! http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/health"; then
  if tcp_port_connects_localhost "$HTTP_PORT"; then
    echo "e2e-web-servers: port ${HTTP_PORT} is in use but does not respond like this API (/api/ready). Free it or set HTTP_PORT." >&2
    exit 1
  fi
fi

if (( forbid_reuse == 0 )) && { http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/ready" || http_get_succeeds "http://127.0.0.1:${HTTP_PORT}/api/health"; }; then
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
# Same-origin /api in the browser; preview server proxies to the API (see vite.config.ts preview.proxy).
export PREVIEW_API_PROXY="http://127.0.0.1:${HTTP_PORT}"
exec bun ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173
