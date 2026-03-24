#!/usr/bin/env bash
# Interactive launcher: gum TUI for action → database → run mode, with defaults and back navigation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
source "$SCRIPT_DIR/lib.sh"

# --- Premium TUI labels (used for gum choose + parsing) ---
LBL_ACT_TEST="🧪  Test — backend + frontend checks"
LBL_ACT_RUN="🚀  Run — API + frontend dev stack"
LBL_ACT_BUILD="🏗️  Build — Docker images only"
LBL_ACT_QUIT="👋  Quit"

LBL_DB_SQLITE="🗃️  SQLite — file-backed, zero setup"
LBL_DB_POSTGRES="🐘  Postgres — Docker service on localhost"
LBL_DB_MARIADB="🐬  MariaDB — Docker service on localhost"
LBL_DB_MONGO="🍃  MongoDB — Docker service on localhost"
LBL_BACK="⬅️  Back — previous step"

LBL_MODE_LOCAL="💻  Local — API + Vite on this machine"
LBL_MODE_DOCKER="🐳  Docker — full stack via Compose"

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
    (cd "$ROOT" && docker compose --profile mongo down mongo) 2>/dev/null || \
      (cd "$ROOT" && docker compose --profile mongo stop mongo) 2>/dev/null || true
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
run_tests() {
  print_section "🧪 Backend: tests"
  run_task "Running backend tests" bash -c "cd $BACKEND && go test -v ./..."
  print_section "🧪 Frontend: check & build"
  start_spinner "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm ci 2>/dev/null || npm install) 2>/dev/null
  stop_spinner
  ok "Dependencies installed"
  run_task "Frontend check & build" bash -c "cd $FRONTEND && npm run check && npm run build"
  echo ""
}

ensure_postgres() {
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
  print_section "🐬 MariaDB: starting (Docker)"
  start_spinner "Starting MariaDB container..."
  (cd "$ROOT" && docker compose --profile mariadb up -d mariadb) 2>/dev/null
  stop_spinner
  start_spinner "Waiting for MariaDB on 127.0.0.1:3306..."
  local i=0
  while (( i < 90 )); do
    if (cd "$ROOT" && docker compose --profile mariadb exec -T mariadb healthcheck.sh --connect --innodb_initialized) >/dev/null 2>&1; then
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
  print_section "🍃 MongoDB: starting (Docker)"
  start_spinner "Starting MongoDB container..."
  (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo up -d mongo) 2>/dev/null
  stop_spinner
  start_spinner "Waiting for MongoDB on 127.0.0.1:27017..."
  local i=0
  while (( i < 60 )); do
    if (cd "$ROOT" && docker compose --profile mongo exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1); then
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
  local db="$1"
  if [[ "$db" == "Postgres" ]]; then
    POSTGRES_LOCAL_STARTED=1
    ensure_postgres || exit 1
    export DB_DRIVER=pgx
    export DB_DSN="${DB_DSN:-postgres://postgres:postgres@127.0.0.1:5432/tasks?sslmode=disable}"
  elif [[ "$db" == "MariaDB" ]]; then
    MARIADB_LOCAL_STARTED=1
    ensure_mariadb || exit 1
    export DB_DRIVER=mariadb
    export DB_DSN="${DB_DSN:-root:password@tcp(127.0.0.1:3306)/tasks?parseTime=true&charset=utf8mb4&loc=UTC&timeout=10s&readTimeout=5s&writeTimeout=5s}"
  elif [[ "$db" == "MongoDB" ]]; then
    MONGO_LOCAL_STARTED=1
    ensure_mongo || exit 1
    export MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
    export MONGO_DATABASE="${MONGO_DATABASE:-tasks}"
  else
    export DB_DRIVER=sqlite3
    unset DB_DSN
  fi

  print_section "🚀 Backend: starting API (DB=$db)"
  if [[ "$db" == "MongoDB" ]]; then
    (cd "$BACKEND" && go run ./cmd/api-mongo) &
  else
    (cd "$BACKEND" && go run ./cmd/api) &
  fi
  API_PID=$!
  cleanup() {
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  sleep 2
  if ! kill -0 "$API_PID" 2>/dev/null; then
    fail "API failed to start"
    exit 1
  fi
  ok "API running at http://localhost:8080"
  info "Health: /api/health — Ready: /api/ready"
  printf '\n'
  print_section "🌐 Frontend: dev server"
  if command -v bun >/dev/null 2>&1; then
    (cd "$FRONTEND" && bun install >/dev/null 2>&1 || true; VITE_API_BASE="http://localhost:8080" bun run dev)
  else
    (cd "$FRONTEND" && npm install 2>/dev/null || true; VITE_API_BASE="http://localhost:8080" npm run dev)
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
  gum_pick "🎯  What would you like to do?" "$LBL_ACT_RUN" \
    "$LBL_ACT_TEST" \
    "$LBL_ACT_RUN" \
    "$LBL_ACT_BUILD" \
    "$LBL_ACT_QUIT"
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
          "API → http://localhost:8080  ·  Ctrl+C stops the stack when you're done."
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
          "go test ./…  ·  npm run check && npm run build"
        run_tests
        summary_card \
          "✅  All tests passed" \
          "" \
          "Nice work — tree’s green. 🌿"
        exit 0
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
