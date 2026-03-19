#!/usr/bin/env bash
# Build, test, and run the iOS app on the iOS Simulator via Capacitor.
# - Default mode: starts local Go API on a fixed port and points the app at it.
# - Optional mode: `--local-sqlite` skips the API and uses on-device SQLite instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

source "$SCRIPT_DIR/lib.sh"

PM="npm"
if command -v bun >/dev/null 2>&1; then
  PM="bun"
fi

ensure_macos_and_xcode() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    fail "iOS run requires macOS (Xcode)."
    exit 1
  fi
  if ! command -v xcodebuild >/dev/null 2>&1; then
    fail "xcodebuild not found. Install Xcode command line tools."
    exit 1
  fi
}

API_PID=""
API_PORT=8081
API_BASE_URL="http://localhost:${API_PORT}"
LOCAL_SQLITE=0

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo "Stopping API server (pid=$API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM

usage() {
  cat >&2 <<'EOF'
Usage: ./scripts/run-ios.sh [--local-sqlite] [--api-port <port>] [--api-url <url>]

Examples:
  ./scripts/run-ios.sh
  ./scripts/run-ios.sh --api-port 8082
  ./scripts/run-ios.sh --api-url http://192.168.1.50:8082
  ./scripts/run-ios.sh --local-sqlite
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-sqlite)
      LOCAL_SQLITE=1
      shift
      ;;
    --api-port)
      API_PORT="${2:?missing value for --api-port}"
      API_BASE_URL="http://localhost:${API_PORT}"
      shift 2
      ;;
    --api-url)
      API_BASE_URL="${2:?missing value for --api-url}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

run_tests() {
  print_section "Backend: tests"
  (cd "$BACKEND" && go test -v ./...)

  print_section "Frontend: check and build"
  if [[ "$PM" == "bun" ]]; then
    (cd "$FRONTEND" && bun install >/dev/null 2>&1 || true)
    (cd "$FRONTEND" && bun run check && bun run build)
  else
    (cd "$FRONTEND" && npm ci 2>/dev/null || npm install)
    (cd "$FRONTEND" && npm run check && npm run build)
  fi
}

build_web_assets() {
  print_section "Frontend: build for iOS Simulator"
  if (( LOCAL_SQLITE == 1 )); then
    (cd "$FRONTEND" && VITE_MOBILE_LOCAL_DB=true ${PM} run build)
  else
    # For iOS Simulator, `localhost` typically resolves to the host machine.
    (cd "$FRONTEND" && VITE_API_BASE="${API_BASE_URL}" ${PM} run build)
  fi
}

run_cap_sync() {
  print_section "Capacitor: sync iOS"
  (cd "$FRONTEND" && npx cap sync ios)
}

run_ios_simulator() {
  print_section "iOS: launching simulator app"
  # `cap run ios` will build and install; if the app is already present it will reinstall.
  (cd "$FRONTEND" && npx cap run ios)
}

start_backend_api() {
  print_section "Backend: starting API on :$API_PORT"
  (cd "$BACKEND" && HTTP_PORT="$API_PORT" go run ./cmd/api) &
  API_PID=$!
  sleep 3
  if ! kill -0 "$API_PID" 2>/dev/null; then
    fail "API failed to start (port $API_PORT may be in use)."
    exit 1
  fi
  ok "API running at ${API_BASE_URL}"
}

main() {
  ensure_macos_and_xcode
  run_tests

  if (( LOCAL_SQLITE == 0 )); then
    start_backend_api
  else
    print_section "Local SQLite mode: skipping API"
  fi

  build_web_assets
  run_cap_sync
  run_ios_simulator

  if [[ -n "${API_PID:-}" ]]; then
    info "API will continue running. Press Ctrl+C to stop."
    wait "$API_PID"
  fi
}

main "$@"

