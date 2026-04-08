#!/usr/bin/env bash
# Interactive launcher: gum TUI for action → database → run mode, with defaults and back navigation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
export GOV_DTS_ROOT="$ROOT"
source "$SCRIPT_DIR/lib.sh"

# --- Premium TUI labels (used for gum choose + parsing) ---
LBL_ACT_TEST="🧪  Test — backend + frontend checks"
LBL_ACT_STORYBOOK="📚  Storybook — frontend components"
LBL_ACT_RUN="🚀  Run — API + Vite on this machine"
LBL_ACT_BUILD="🏗️  Build — Docker images only"
LBL_ACT_MOBILE="📱  Mobile — Android/iOS workflows"
LBL_ACT_QUIT="👋  Quit"

LBL_DB_SQLITE="🗃️  SQLite — file-backed, zero setup"
LBL_DB_POSTGRES="🐘  Postgres — Docker service on localhost"
LBL_DB_MARIADB="🐬  MariaDB — Docker service on localhost"
LBL_DB_MONGO="🍃  MongoDB — Docker service on localhost"
LBL_BACK="⬅️  Back — previous step"

LBL_MODE_LOCAL="💻  Local — API + Vite on this machine"
LBL_MODE_DOCKER="🐳  Docker — full stack via Compose"

LBL_MOBILE_ANDROID="🤖  Android"
LBL_MOBILE_IOS="🍎  iOS (coming soon)"
LBL_ANDROID_LOCAL="📲  Local — run app on emulator/device"
LBL_ANDROID_APK="📦  Generate APK — local SQLite debug build"

# Track resources started by this script so we can clean them up on exit.
API_PID=""
POSTGRES_LOCAL_STARTED=0
MARIADB_LOCAL_STARTED=0
MONGO_LOCAL_STARTED=0

cleanup_all() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    info "Stopping API server..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  if (( POSTGRES_LOCAL_STARTED == 1 )); then
    info "Stopping Postgres container..."
    (cd "$ROOT" && docker compose --profile postgres down postgres) 2>/dev/null || \
      (cd "$ROOT" && docker compose --profile postgres stop postgres) 2>/dev/null || true
  fi

  if (( MARIADB_LOCAL_STARTED == 1 )); then
    info "Stopping MariaDB container..."
    (cd "$ROOT" && docker compose --profile mariadb down mariadb) 2>/dev/null || \
      (cd "$ROOT" && docker compose --profile mariadb stop mariadb) 2>/dev/null || true
  fi

  if (( MONGO_LOCAL_STARTED == 1 )); then
    info "Stopping MongoDB container..."
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo down mongo) 2>/dev/null || \
      (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo stop mongo) 2>/dev/null || true
  fi
}

require_gum() {
  if ! command -v gum >/dev/null 2>&1; then
    printf '\n  \033[31m✗\033[0m gum is required for this launcher.\n\n' >&2
    printf '  Install: \033[36mhttps://github.com/charmbracelet/gum#installation\033[0m\n' >&2
    printf '  e.g. \033[33mbrew install gum\033[0m or \033[33mpacman -S gum\033[0m\n\n' >&2
    exit 1
  fi
  if [[ ! -t 0 ]]; then
    printf '\n  \033[31m✗\033[0m Interactive terminal required (stdin is not a TTY).\n\n' >&2
    exit 1
  fi
}

# Gum theme — subtle purple/cyan accents
export GUM_CHOOSE_CURSOR_FOREGROUND="213"
export GUM_CHOOSE_HEADER_FOREGROUND="117"
export GUM_CHOOSE_SELECTED_FOREGROUND="255"

ui_banner() {
  clear 2>/dev/null || true
  gum style \
    --margin "1 0" \
    --padding "1 3" \
    --border double \
    --border-foreground "99" \
    --align center \
    --foreground "252" \
    "📋  DTS Caseworker Task Manager" \
    "" \
    "$(gum style --foreground "244" "Pick a flow — defaults match the usual dev path. Use ← Back anytime.")"
}

gum_pick() {
  local header="$1"
  local selected="$2"
  shift 2
  gum choose \
    --cursor "▶ " \
    --header "$header" \
    --selected "$selected" \
    "$@"
}

summary_card() {
  gum style \
    --margin "1 0" \
    --padding "1 3" \
    --border rounded \
    --border-foreground "111" \
    --foreground "252" \
    "$@"
}

run_script_quiet() {
  local label="$1"
  local script_path="$2"
  shift 2

  if [[ ! -x "$script_path" ]]; then
    fail "Script not found or not executable: $script_path"
    return 1
  fi

  local log_file
  log_file="$(mktemp)"
  start_spinner "$label..."
  if "$script_path" "$@" >"$log_file" 2>&1; then
    stop_spinner
    ok "$label"
    rm -f "$log_file"
    return 0
  fi
  stop_spinner
  fail "$label failed"
  echo ""
  info "Error output:"
  sed -n '1,180p' "$log_file" >&2 || true
  rm -f "$log_file"
  return 1
}

db_internal_name() {
  case "$1" in
    "$LBL_DB_SQLITE") printf '%s\n' "SQLite" ;;
    "$LBL_DB_POSTGRES") printf '%s\n' "Postgres" ;;
    "$LBL_DB_MARIADB") printf '%s\n' "MariaDB" ;;
    "$LBL_DB_MONGO") printf '%s\n' "MongoDB" ;;
    *) return 1 ;;
  esac
}

# --- Actions ---
require_bun() {
  if ! command -v bun >/dev/null 2>&1; then
    printf '\n  \033[31m✗\033[0m bun is required for frontend tests and dev (https://bun.sh)\n\n' >&2
    exit 1
  fi
}

run_tests() {
  require_bun
  print_section "🧪 Backend: tests"
  run_task "Running backend tests" bash -c "cd \"$BACKEND\" && go test -v ./..."
  print_section "🧪 Frontend: check & build"
  start_spinner "Installing frontend dependencies..."
  (cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install) 2>/dev/null
  stop_spinner
  ok "Dependencies installed"
  run_task "Frontend check, test & build" bash -c "cd \"$FRONTEND\" && bun run check && bun run test && bun run build"
  echo ""
}

run_storybook() {
  require_bun
  print_section "📚 Frontend: Storybook"
  start_spinner "Installing frontend dependencies..."
  (cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install) 2>/dev/null
  stop_spinner
  ok "Dependencies installed"

  run_task "Building Storybook" bash -c "cd \"$FRONTEND\" && bun run build-storybook"
  echo ""

  local sb_port="${STORYBOOK_PORT:-6006}"
  GOV_DTS_REUSE_STORYBOOK_ON_PORT=0
  ensure_storybook_listen_port_for_run "$sb_port" "Storybook dev server" || exit 1

  if [[ "${GOV_DTS_REUSE_STORYBOOK_ON_PORT:-0}" == "1" ]]; then
    print_section "📚 Storybook: already running"
    info "Open http://localhost:${sb_port}/ (STORYBOOK_PORT)"
    info "Press Ctrl+C to exit this launcher."
    while true; do sleep 3600; done
  fi

  print_section "📚 Storybook: dev server"
  info "Storybook → http://localhost:${sb_port} (STORYBOOK_PORT)"
  info "Ctrl+C stops Storybook."
  echo ""
  (cd "$FRONTEND" && bun run storybook -- --port "$sb_port" --no-open)
}

ensure_postgres() {
  if gov_dts_postgres_port_ready; then
    ok "Postgres is already listening on 127.0.0.1:5432 — using it (no new container)."
    return 0
  fi
  if tcp_port_connects_localhost 5432; then
    ensure_tcp_port_free 5432 "Postgres (127.0.0.1:5432)" || return 1
  fi
  POSTGRES_LOCAL_STARTED=1
  print_section "🐘 Postgres: starting (Docker)"
  start_spinner "Starting Postgres container..."
  (cd "$ROOT" && docker compose --profile postgres up -d postgres) 2>/dev/null
  stop_spinner
  start_spinner "Waiting for Postgres on 127.0.0.1:5432..."
  local i=0
  while (( i < 60 )); do
    if (cd "$ROOT" && docker compose --profile postgres exec -T postgres pg_isready -h 127.0.0.1 -U postgres -d tasks) >/dev/null 2>&1; then
      stop_spinner
      ok "Postgres is ready"
      sleep 2
      return 0
    fi
    sleep 1
    (( i++ )) || true
  done
  stop_spinner
  fail "Postgres did not become ready in time"
  return 1
}

ensure_mariadb() {
  if gov_dts_mariadb_port_ready; then
    ok "MariaDB is already listening on 127.0.0.1:3306 — using it (no new container)."
    return 0
  fi
  if tcp_port_connects_localhost 3306; then
    ensure_tcp_port_free 3306 "MariaDB (127.0.0.1:3306)" || return 1
  fi
  MARIADB_LOCAL_STARTED=1
  print_section "🐬 MariaDB: starting (Docker)"
  start_spinner "Starting MariaDB container..."
  (cd "$ROOT" && docker compose --profile mariadb up -d mariadb) 2>/dev/null
  stop_spinner
  start_spinner "Waiting for MariaDB on 127.0.0.1:3306..."
  local i=0
  while (( i < 90 )); do
    if gov_dts_mariadb_port_ready; then
      stop_spinner
      ok "MariaDB is ready"
      sleep 2
      return 0
    fi
    sleep 1
    (( i++ )) || true
  done
  stop_spinner
  fail "MariaDB did not become ready in time"
  return 1
}

ensure_mongo() {
  if gov_dts_mongo_port_ready; then
    ok "MongoDB is already listening on 127.0.0.1:27017 — using it (no new container)."
    return 0
  fi
  if tcp_port_connects_localhost 27017; then
    # If something already listens on Mongo's standard port, prefer reuse.
    # This avoids forcing a kill path when PID resolution/probing is limited.
    ok "Port 27017 is already in use — assuming existing MongoDB and reusing it."
    return 0
  fi
  MONGO_LOCAL_STARTED=1
  print_section "🍃 MongoDB: starting (Docker)"
  start_spinner "Starting MongoDB container..."
  (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo up -d mongo) 2>/dev/null
  stop_spinner
  start_spinner "Waiting for MongoDB on 127.0.0.1:27017..."
  local i=0
  while (( i < 60 )); do
    if (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1); then
      stop_spinner
      ok "MongoDB is ready"
      sleep 2
      return 0
    fi
    sleep 1
    (( i++ )) || true
  done
  stop_spinner
  fail "MongoDB did not become ready in time"
  return 1
}

run_local() {
  require_bun
  local db="$1"
  POSTGRES_LOCAL_STARTED=0
  MARIADB_LOCAL_STARTED=0
  MONGO_LOCAL_STARTED=0
  if [[ "$db" == "Postgres" ]]; then
    ensure_postgres || exit 1
    export DB_DRIVER=pgx
    export DB_DSN="${DB_DSN:-postgres://postgres:postgres@127.0.0.1:5432/tasks?sslmode=disable}"
  elif [[ "$db" == "MariaDB" ]]; then
    ensure_mariadb || exit 1
    export DB_DRIVER=mariadb
    export DB_DSN="${DB_DSN:-ci:ci_password@tcp(127.0.0.1:3306)/tasks?parseTime=true&charset=utf8mb4&loc=UTC&timeout=10s&readTimeout=5s&writeTimeout=5s}"
  elif [[ "$db" == "MongoDB" ]]; then
    ensure_mongo || exit 1
    export MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
    export MONGO_DATABASE="${MONGO_DATABASE:-tasks}"
  else
    export DB_DRIVER=sqlite3
    unset DB_DSN
  fi

  export HTTP_PORT="${HTTP_PORT:-8080}"
  GOV_DTS_REUSE_API_ON_PORT=0
  ensure_api_listen_port_for_run "$HTTP_PORT" "API (backend HTTP)" || exit 1

  API_PID=""
  if [[ "${GOV_DTS_REUSE_API_ON_PORT:-0}" != "1" ]]; then
    print_section "🚀 Backend: starting API (DB=$db)"
    if [[ "$db" == "MongoDB" ]]; then
      (cd "$BACKEND" && go run ./cmd/api-mongo) &
    else
      (cd "$BACKEND" && go run ./cmd/api) &
    fi
    API_PID=$!
    sleep 2
    if ! kill -0 "$API_PID" 2>/dev/null; then
      fail "API failed to start"
      exit 1
    fi
    ok "API running at http://localhost:${HTTP_PORT}"
    wait_for_api_ready "http://127.0.0.1:${HTTP_PORT}" 90 "API (DB=$db)" || exit 1
  else
    info "Using existing API on http://localhost:${HTTP_PORT} (already ready)."
  fi
  info "Health: /api/health — Ready: /api/ready"
  printf '\n'

  trap cleanup_all EXIT INT TERM

  local vite_port="${VITE_DEV_PORT:-5173}"
  GOV_DTS_REUSE_VITE_ON_PORT=0
  ensure_vite_listen_port_for_run "$vite_port" "Vite dev server" || exit 1

  local api_base="http://localhost:${HTTP_PORT}"
  if [[ "${GOV_DTS_REUSE_VITE_ON_PORT:-0}" == "1" ]]; then
    info "Vite already running on http://localhost:${vite_port} — not starting another dev server."
    info "Press Ctrl+C to exit (API${API_PID:+ started by this session} will be stopped if applicable)."
    while true; do sleep 3600; done
  fi

  print_section "🌐 Frontend: dev server"
  if command -v bun >/dev/null 2>&1; then
    (cd "$FRONTEND" && bun install >/dev/null 2>&1 || true; VITE_API_BASE="$api_base" bun run dev -- --port "$vite_port")
  else
    (cd "$FRONTEND" && bun install 2>/dev/null || true; VITE_API_BASE="$api_base" bun run dev -- --port "$vite_port")
  fi
}

run_docker() {
  local db="$1"
  if [[ "$db" == "Postgres" ]]; then
    print_section "🐳 Docker: API + Frontend + Postgres"
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres up --build)
  elif [[ "$db" == "MariaDB" ]]; then
    print_section "🐳 Docker: API + Frontend + MariaDB"
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mariadb.yml --profile mariadb up --build)
  elif [[ "$db" == "MongoDB" ]]; then
    print_section "🐳 Docker: API + Frontend + MongoDB"
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo up --build)
  else
    print_section "🐳 Docker: API + Frontend (SQLite)"
    (cd "$ROOT" && docker compose up --build)
  fi
}

run_build_docker() {
  local db="$1"
  info "Building Docker images..."
  if [[ "$db" == "Postgres" ]]; then
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres build)
  elif [[ "$db" == "MariaDB" ]]; then
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mariadb.yml --profile mariadb build)
  else
    (cd "$ROOT" && docker compose build)
  fi
  local ret=$?
  if (( ret == 0 )); then
    ok "Docker build finished"
  else
    fail "Docker build failed"
  fi
  return $ret
}

pick_action() {
  gum_pick "🎯  What would you like to do?" "$LBL_ACT_TEST" \
    "$LBL_ACT_TEST" \
    "$LBL_ACT_STORYBOOK" \
    "$LBL_ACT_BUILD" \
    "$LBL_ACT_RUN" \
    "$LBL_ACT_MOBILE" \
    "$LBL_ACT_QUIT"
}

pick_mobile_platform() {
  gum_pick "📱  Mobile workflows" "$LBL_MOBILE_ANDROID" \
    "$LBL_MOBILE_ANDROID" \
    "$LBL_MOBILE_IOS" \
    "$LBL_BACK"
}

pick_android_flow() {
  gum_pick "🤖  Android options" "$LBL_ANDROID_LOCAL" \
    "$LBL_ANDROID_LOCAL" \
    "$LBL_ANDROID_APK" \
    "$LBL_BACK"
}

pick_database() {
  gum_pick "🗄️  Which database engine?" "$LBL_DB_SQLITE" \
    "$LBL_DB_SQLITE" \
    "$LBL_DB_POSTGRES" \
    "$LBL_DB_MARIADB" \
    "$LBL_DB_MONGO" \
    "$LBL_BACK"
}

pick_run_mode() {
  gum_pick "📍  Where should the stack run?" "$LBL_MODE_LOCAL" \
    "$LBL_MODE_LOCAL" \
    "$LBL_MODE_DOCKER" \
    "$LBL_BACK"
}

flow_run_stack() {
  local db_choice mode_choice run_db
  while true; do
    db_choice=$(pick_database)
    [[ "$db_choice" == "$LBL_BACK" ]] && return 0
    run_db=$(db_internal_name "$db_choice") || continue

    while true; do
      mode_choice=$(pick_run_mode)
      [[ "$mode_choice" == "$LBL_BACK" ]] && break
      if [[ "$mode_choice" == "$LBL_MODE_LOCAL" ]]; then
        summary_card \
          "✨  Ready to launch" \
          "" \
          "🎯  Run" \
          "🗄️  $run_db" \
          "💻  Local — API + Vite" \
          "" \
          "API → http://localhost:8080 (HTTP_PORT)  ·  Vite → :5173 (VITE_DEV_PORT)  ·  Ctrl+C stops the stack."
        run_local "$run_db"
        exit 0
      fi
      if [[ "$mode_choice" == "$LBL_MODE_DOCKER" ]]; then
        summary_card \
          "✨  Ready to launch" \
          "" \
          "🎯  Run" \
          "🗄️  $run_db" \
          "🐳  Docker Compose" \
          "" \
          "Compose attaches logs here — Ctrl+C stops the stack."
        run_docker "$run_db"
        exit 0
      fi
    done
  done
}

flow_build_images() {
  local db_choice build_db
  while true; do
    db_choice=$(pick_database)
    [[ "$db_choice" == "$LBL_BACK" ]] && return 0
    build_db=$(db_internal_name "$db_choice") || continue
    summary_card \
      "✨  Docker build" \
      "" \
      "🏗️  Build images only" \
      "🗄️  $build_db" \
      "" \
      "Images only — no containers started."
    run_build_docker "$build_db"
    local st=$?
    if (( st == 0 )); then
      summary_card \
        "✅  Build succeeded" \
        "" \
        "Images are ready — launch the stack from this menu when you need it."
    else
      summary_card \
        "✗  Build failed" \
        "" \
        "Fix the errors above and try again."
    fi
    exit "$st"
  done
}

flow_mobile() {
  local platform_choice android_choice
  while true; do
    platform_choice=$(pick_mobile_platform)
    [[ "$platform_choice" == "$LBL_BACK" ]] && return 0

    case "$platform_choice" in
      "$LBL_MOBILE_IOS")
        summary_card \
          "🍎  iOS support" \
          "" \
          "Use existing scripts directly for now:" \
          "• scripts/run-ios.sh" \
          "• scripts/build-ios-simulator-local-sqlite.sh"
        ;;
      "$LBL_MOBILE_ANDROID")
        while true; do
          android_choice=$(pick_android_flow)
          [[ "$android_choice" == "$LBL_BACK" ]] && break

          case "$android_choice" in
            "$LBL_ANDROID_LOCAL")
              summary_card \
                "✨  Mobile → Android → Local" \
                "" \
                "Runs backend, builds frontend for emulator, launches Android app."
              run_script_quiet "Android local run" "$SCRIPT_DIR/run-android.sh"
              exit $?
              ;;
            "$LBL_ANDROID_APK")
              summary_card \
                "✨  Mobile → Android → Generate APK" \
                "" \
                "Builds local-SQLite debug APK (and installs if adb device is connected)."
              run_script_quiet "Android APK build" "$SCRIPT_DIR/build-android-local-sqlite.sh"
              exit $?
              ;;
          esac
        done
        ;;
    esac
  done
}

main() {
  require_gum
  ui_banner

  while true; do
    local act
    act=$(pick_action)
    case "$act" in
      "$LBL_ACT_TEST")
        summary_card \
          "✨  Test run" \
          "" \
          "🧪  Backend tests + frontend check/build" \
          "" \
          "go test ./…  ·  bun run check && bun run test && bun run build"
        run_tests
        summary_card \
          "✅  All tests passed" \
          "" \
          "Nice work — tree’s green. 🌿"
        exit 0
        ;;
      "$LBL_ACT_STORYBOOK")
        summary_card \
          "✨  Storybook" \
          "" \
          "📚  Build + run Storybook (frontend components)" \
          "" \
          "bun run build-storybook  ·  bun run storybook"
        run_storybook
        exit 0
        ;;
      "$LBL_ACT_MOBILE")
        flow_mobile
        ;;
      "$LBL_ACT_QUIT")
        gum style --margin "1" --foreground "244" "👋  See you next time."
        exit 0
        ;;
      "$LBL_ACT_RUN")
        flow_run_stack
        ;;
      "$LBL_ACT_BUILD")
        flow_build_images
        ;;
      *)
        gum style --foreground "196" "Unexpected choice — try again."
        ;;
    esac
  done
}

main "$@"
