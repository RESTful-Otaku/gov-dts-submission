#!/usr/bin/env bash
# Interactive menu: choose action (test / run / build), DB (SQLite / Postgres / MariaDB), and mode (local / Docker).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
source "$SCRIPT_DIR/lib.sh"

# Track resources started by this script so we can clean them up on exit.
API_PID=""
POSTGRES_LOCAL_STARTED=0
MARIADB_LOCAL_STARTED=0

cleanup_all() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    info "Stopping API server..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  # Stop locally-started Postgres container (used for Run → Postgres → Local)
  if (( POSTGRES_LOCAL_STARTED == 1 )); then
    info "Stopping Postgres container..."
    (cd "$ROOT" && docker compose --profile postgres down postgres) 2>/dev/null || \
      (cd "$ROOT" && docker compose --profile postgres stop postgres) 2>/dev/null || true
  fi

  # Stop locally-started MariaDB container (used for Run → MariaDB → Local)
  if (( MARIADB_LOCAL_STARTED == 1 )); then
    info "Stopping MariaDB container..."
    (cd "$ROOT" && docker compose --profile mariadb down mariadb) 2>/dev/null || \
      (cd "$ROOT" && docker compose --profile mariadb stop mariadb) 2>/dev/null || true
  fi
}

menu() {
  local default="${1:-1}"
  shift
  local prompt="$1"
  shift
  local i=1
  local options=("$@")
  for opt in "${options[@]}"; do
    printf '  %d) %s\n' "$i" "$opt" >&2
    ((i++)) || true
  done
  printf '\n' >&2
  while true; do
    read -r -p "$prompt [1-$#] (default $default): " choice
    choice="${choice:-$default}"
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= $# )); then
      echo "$choice"
      return
    fi
    echo "Invalid option. Enter a number 1-$#." >&2
  done
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
  info "MariaDB container started — API will connect when ready"
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
  else
    export DB_DRIVER=sqlite3
    unset DB_DSN
  fi

  print_section "🚀 Backend: starting API (DB=$db)"
  (cd "$BACKEND" && go run ./cmd/api) &
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
  (cd "$FRONTEND" && npm install 2>/dev/null; npm run dev)
}

run_docker() {
  local db="$1"
  if [[ "$db" == "Postgres" ]]; then
    print_section "🐳 Docker: API + Frontend + Postgres"
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres up --build)
  elif [[ "$db" == "MariaDB" ]]; then
    print_section "🐳 Docker: API + Frontend + MariaDB"
    (cd "$ROOT" && docker compose -f docker-compose.yml -f docker-compose.mariadb.yml --profile mariadb up --build)
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

# --- Main menu ---
main() {
  clear 2>/dev/null || true
  echo ""
  printf '\033[1;36m'
  printf '  ╭─────────────────────────────────────────╮\n'
  printf '  │  📋 DTS Caseworker Task Manager         │\n'
  printf '  │  Task management for caseworkers        │\n'
  printf '  ╰─────────────────────────────────────────╯\n'
  printf '\033[0m\n'
  ACTION=$(menu 2 "What do you want to do?" "Test (backend + frontend)" "Run (API + frontend)" "Build (Docker images only)" "Quit")
  echo ""

  case "$ACTION" in
    1)
      run_tests
      ok "All tests passed!"
      ;;
    2)
      DB=$(menu 1 "Which database?" "SQLite" "Postgres" "MariaDB")
      MODE=$(menu 1 "Run where?" "Local (API + frontend on this machine)" "Docker (compose)")
      case "$DB" in
        1) run_db="SQLite" ;;
        2) run_db="Postgres" ;;
        3) run_db="MariaDB" ;;
      esac
      case "$MODE" in
        1) run_local "$run_db" ;;
        2) run_docker "$run_db" ;;
      esac
      ;;
    3)
      DB=$(menu 1 "Which database for Docker build?" "SQLite" "Postgres" "MariaDB")
      case "$DB" in
        1) build_db="SQLite" ;;
        2) build_db="Postgres" ;;
        3) build_db="MariaDB" ;;
      esac
      run_build_docker "$build_db"
      ;;
    4)
      printf '\n  👋 Bye!\n\n'
      exit 0
      ;;
  esac
}

main "$@"

