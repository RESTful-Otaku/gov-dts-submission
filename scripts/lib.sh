#!/usr/bin/env bash
# Shared helpers for run scripts — TUI menus, spinners, formatting.

# Colors
C_BOLD='\033[1m'
C_DIM='\033[2m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_BLUE='\033[34m'
C_CYAN='\033[36m'
C_BG_CYAN='\033[46;30m'
C_RESET='\033[0m'

# Box drawing
BOX_UL='╭'
BOX_UR='╮'
BOX_LL='╰'
BOX_LR='╯'
BOX_H='─'
BOX_V='│'

print_section() {
  printf '\n\033[1;36m▶ %s\033[0m\n' "$1"
}

# Spinner frames
SPINNER=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

start_spinner() {
  local msg="$1"
  ( while true; do
    for c in "${SPINNER[@]}"; do
      printf '\r  %s %s  ' "$c" "$msg"
      sleep 0.1
    done
  done ) &
  _spin_pid=$!
}
stop_spinner() {
  if [[ -n "${_spin_pid:-}" ]] && kill -0 "$_spin_pid" 2>/dev/null; then
    kill "$_spin_pid" 2>/dev/null || true
    wait "$_spin_pid" 2>/dev/null || true
  fi
  _spin_pid=""
  printf '\r\033[K'
}

ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; }
info() { printf '  \033[36m→\033[0m %s\n' "$1"; }

# Run command with header; output streams live
run_task() {
  local label="$1"
  shift
  printf '\n  \033[2m⟳ %s\033[0m\n' "$label"
  if "$@"; then
    printf '  \033[32m✓ %s\033[0m\n' "$label"
    return 0
  else
    printf '  \033[31m✗ %s failed\033[0m\n' "$label"
    return 1
  fi
}

# Arrow-key TUI menu — returns selected index (1-based)
tui_menu() {
  local prompt="$1"
  shift
  local -a options=("$@")
  local n=${#options[@]}
  local sel=1
  local width=${#prompt}
  for opt in "${options[@]}"; do
    [[ ${#opt} -gt $width ]] && width=${#opt}
  done
  width=$(( width + 4 ))
  [[ $width -lt 44 ]] && width=44

  local menu_lines=$(( n + 5 ))
  [[ -t 0 ]] && stty -echo -icanon 2>/dev/null
  trap '[[ -t 0 ]] && stty echo icanon 2>/dev/null; tput cnorm 2>/dev/null' RETURN
  tput civis 2>/dev/null

  draw_menu() {
    local idx=1 hbar
    hbar=$(printf "%*s" "$((width-2))" "" | tr ' ' '─')
    printf '\r\033[K\033[1;36m╭%s╮\033[0m\n' "$hbar"
    printf '\033[1;36m│\033[0m \033[1m%-*s\033[0m\033[1;36m│\033[0m\n' "$((width-4))" "$prompt"
    printf '\033[1;36m├%s┤\033[0m\n' "$hbar"
    for opt in "${options[@]}"; do
      if [[ $idx -eq $sel ]]; then
        printf '\033[1;36m│\033[0m \033[7m %-*s \033[0m\033[1;36m│\033[0m\n' "$((width-4))" "$opt"
      else
        printf '\033[1;36m│\033[0m   %-*s\033[1;36m│\033[0m\n' "$((width-4))" "$opt"
      fi
      (( idx++ )) || true
    done
    printf '\033[1;36m╰%s╯\033[0m\n' "$hbar"
    printf '\033[2m ↑/↓ navigate   Enter select   [1-9] shortcut\033[0m\033[K\n'
  }

  draw_menu
  while true; do
    local key=""
    IFS= read -rsn 1 key 2>/dev/null
    if [[ "$key" == $'\033' ]]; then
      read -rsn 2 -t 0.5 key 2>/dev/null
      case "$key" in
        '[A'|'OA') (( sel > 1 )) && (( sel-- )) ;;
        '[B'|'OB') (( sel < n )) && (( sel++ )) ;;
      esac
    elif [[ "$key" == "" ]] || [[ "$key" == $'\n' ]]; then
      break
    elif [[ "$key" =~ ^[1-9]$ ]] && (( key >= 1 && key <= n )); then
      sel=$key
      break
    fi
    for ((i=0; i<menu_lines; i++)); do printf '\033[A\033[K'; done 2>/dev/null
    draw_menu
  done

  for ((i=0; i<menu_lines; i++)); do printf '\033[A\033[K'; done 2>/dev/null
  tput cnorm 2>/dev/null
  [[ -t 0 ]] && stty echo icanon 2>/dev/null
  echo "$sel"
}

# Wrapper: use gum if available, else tui_menu, else number prompt
menu() {
  local prompt="$1"
  shift
  local -a options=("$@")
  local n=$#
  if command -v gum &>/dev/null && [[ -t 0 ]]; then
    local result
    result=$(printf '%s\n' "${options[@]}" | gum choose --cursor="▶" --cursor.foreground="212" --header="$prompt" 2>/dev/null)
    local i=1
    for opt in "${options[@]}"; do
      [[ "$opt" == "$result" ]] && { echo "$i"; return; }
      (( i++ )) || true
    done
    echo "1"
  elif [[ -t 0 ]]; then
    tui_menu "$prompt" "${options[@]}"
  else
    local i=1
    for opt in "${options[@]}"; do
      printf '  %d) %s\n' "$i" "$opt" >&2
      (( i++ )) || true
    done
    local choice
    while true; do
      read -r -p "$prompt [1-$n]: " choice
      [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= n )) && { echo "$choice"; return; }
      echo "Invalid. Enter 1-$n." >&2
    done
  fi
}

# --- TCP ports (listeners on localhost) ---
# Optional: GOV_DTS_FREE_PORTS=1|yes|true — non-interactive: stop listeners without prompting.
# Requires lsof (or fuser on Linux) to resolve PIDs; connection check uses bash /dev/tcp when available.

tcp_port_connects_localhost() {
  local port="${1:?port required}"
  if (true >&/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
    return 0
  fi
  if (true >&/dev/tcp/::1/"$port") 2>/dev/null; then
    return 0
  fi
  return 1
}

get_tcp_listen_pids() {
  local port="${1:?port required}"
  local os pids
  os=$(uname -s 2>/dev/null || echo unknown)
  pids=""
  if command -v lsof >/dev/null 2>&1; then
    if [[ "$os" == "Darwin" ]]; then
      pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
    else
      pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)
    fi
  fi
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp "$port" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u)
  fi
  printf '%s\n' "$pids" | grep -E '^[0-9]+$' | sort -u
}

describe_tcp_port_occupants() {
  local port="${1:?port required}"
  local pid any=0
  info "Port $port appears in use. Current listeners:"
  while IFS= read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    any=1
    if kill -0 "$pid" 2>/dev/null; then
      local cmd
      cmd=$(ps -p "$pid" -o args= 2>/dev/null | head -c 200 || echo "(unknown)")
      printf '  \033[33mPID %s\033[0m  %s\n' "$pid" "$cmd" >&2
    fi
  done < <(get_tcp_listen_pids "$port")
  if (( any == 0 )); then
    info "(Could not resolve PIDs — install lsof or use fuser. Try: ss -lntp | grep :$port )"
  fi
}

kill_tcp_listeners_on_port() {
  local port="${1:?port required}"
  local pid cmd
  local -i killed_any=0
  local -i skipped_any=0
  for pid in $(get_tcp_listen_pids "$port"); do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if command_matches_safe_kill "$cmd"; then
      kill "$pid" 2>/dev/null || true
      killed_any=1
    else
      skipped_any=1
      info "Refusing to stop PID $pid on port $port (not recognized as this project stack): ${cmd:-unknown}"
    fi
  done
  sleep 0.4
  for pid in $(get_tcp_listen_pids "$port"); do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
    if command_matches_safe_kill "$cmd"; then
      kill -9 "$pid" 2>/dev/null || true
      killed_any=1
    fi
  done
  sleep 0.2
  if (( skipped_any == 1 )) && (( killed_any == 0 )); then
    return 2
  fi
  return 0
}

command_matches_safe_kill() {
  local cmd="${1:-}"
  [[ -z "$cmd" ]] && return 1
  local root="${GOV_DTS_ROOT:-}"
  # Allow explicit override for advanced environments.
  local extra="${GOV_DTS_KILL_MATCH_REGEX:-}"
  if [[ -n "$extra" ]] && [[ "$cmd" =~ $extra ]]; then
    return 0
  fi
  [[ -n "$root" && "$cmd" == *"$root/backend"* ]] && return 0
  [[ -n "$root" && "$cmd" == *"$root/frontend"* ]] && return 0
  [[ "$cmd" == *" go run ./cmd/api"* ]] && return 0
  [[ "$cmd" == *" go run ./cmd/api-mongo"* ]] && return 0
  # `go run` compiles to a temp binary like /tmp/go-build…/b001/exe/api
  [[ "$cmd" == *"go-build"*"/exe/api"* ]] && return 0
  [[ "$cmd" == *"bun run dev"* ]] && return 0
  [[ "$cmd" == *"vite preview"* ]] && return 0
  [[ "$cmd" == *"vite.js"* ]] && return 0
  [[ "$cmd" == *"bun run storybook"* ]] && return 0
  [[ "$cmd" == *"storybook"* ]] && return 0
  return 1
}

# Free localhost TCP port before binding. Verifies with a connect probe + listener PIDs.
# Args: port, human label (e.g. "API" or "Vite").
ensure_tcp_port_free() {
  local port="${1:?port required}"
  local label="${2:-Port $port}"

  if ! tcp_port_connects_localhost "$port"; then
    return 0
  fi

  describe_tcp_port_occupants "$port"

  local auto="${GOV_DTS_FREE_PORTS:-}"
  auto=$(printf '%s' "$auto" | tr '[:upper:]' '[:lower:]')

  if [[ "$auto" == "1" || "$auto" == "yes" || "$auto" == "true" ]]; then
    info "GOV_DTS_FREE_PORTS set — stopping listeners on $port..."
    if ! kill_tcp_listeners_on_port "$port"; then
      fail "$label: found listeners on port $port but refused to kill unrecognized processes. Stop them manually."
      return 1
    fi
    if tcp_port_connects_localhost "$port"; then
      fail "$label: port $port is still in use after kill. Free it manually (see lsof/fuser above)."
      return 1
    fi
    ok "Freed $label (port $port)."
    return 0
  fi

  if command -v gum >/dev/null 2>&1 && [[ -t 0 ]]; then
    if gum confirm "$label — port $port is in use. Stop the occupying process(es) and continue?"; then
      if ! kill_tcp_listeners_on_port "$port"; then
        fail "$label: refused to kill unrecognized process(es) on port $port."
        return 1
      fi
      if tcp_port_connects_localhost "$port"; then
        fail "$label: port $port is still in use."
        return 1
      fi
      ok "Freed $label (port $port)."
      return 0
    fi
    fail "Aborted — free port $port manually or set GOV_DTS_FREE_PORTS=1 to auto-stop listeners."
    return 1
  fi

  local ans
  if [[ -t 0 ]]; then
    read -r -p "Port $port is in use ($label). Try to stop listener PIDs? [y/N] " ans
    if [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]; then
      if ! kill_tcp_listeners_on_port "$port"; then
        fail "$label: refused to kill unrecognized process(es) on port $port."
        return 1
      fi
      if tcp_port_connects_localhost "$port"; then
        fail "$label: port $port is still in use."
        return 1
      fi
      ok "Freed $label (port $port)."
      return 0
    fi
  fi

  fail "$label: port $port is in use. Stop it (e.g. lsof -i :$port) or set GOV_DTS_FREE_PORTS=1."
  return 1
}

# --- Reuse existing services (no kill) when a port is already serving our stack ---

# HTTP GET returns 2xx (short timeout).
http_get_succeeds() {
  local url="${1:?url required}"
  curl -sf -o /dev/null --max-time 3 "$url" 2>/dev/null
}

# Wait until API /api/ready responds (fallback: /api/health) before launching clients.
# Args: base_url (e.g. http://127.0.0.1:8080), timeout_seconds, label
wait_for_api_ready() {
  local base_url="${1:?base_url required}"
  local timeout_s="${2:-60}"
  local label="${3:-API}"
  local i=0
  start_spinner "Waiting for ${label} ready endpoint..."
  while (( i < timeout_s )); do
    if http_get_succeeds "${base_url}/api/ready" || http_get_succeeds "${base_url}/api/health"; then
      stop_spinner
      ok "${label} is ready"
      return 0
    fi
    sleep 1
    (( i++ )) || true
  done
  stop_spinner
  fail "${label} did not become ready in time (${timeout_s}s)"
  return 1
}

# Set by ensure_api_listen_port_for_run: 1 = caller should not start a new API process.
GOV_DTS_REUSE_API_ON_PORT="${GOV_DTS_REUSE_API_ON_PORT:-0}"

# Set by ensure_vite_listen_port_for_run: 1 = caller should not start Vite.
GOV_DTS_REUSE_VITE_ON_PORT="${GOV_DTS_REUSE_VITE_ON_PORT:-0}"

# Set by ensure_storybook_listen_port_for_run: 1 = caller should not start Storybook.
GOV_DTS_REUSE_STORYBOOK_ON_PORT="${GOV_DTS_REUSE_STORYBOOK_ON_PORT:-0}"

# If something listens on port and responds like our Go API, reuse it (no kill, no new process).
gov_dts_try_reuse_existing_api() {
  local port="${1:?port required}"
  GOV_DTS_REUSE_API_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 1
  fi
  if http_get_succeeds "http://127.0.0.1:${port}/api/ready" || http_get_succeeds "http://127.0.0.1:${port}/api/health"; then
    ok "Port $port is already serving this app’s API — reusing it (no new server)."
    GOV_DTS_REUSE_API_ON_PORT=1
    return 0
  fi
  return 1
}

# API port: free → start new; already our API → reuse; else prompt/kill as before.
ensure_api_listen_port_for_run() {
  local port="${1:?port required}"
  local label="${2:-API (backend HTTP)}"
  GOV_DTS_REUSE_API_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 0
  fi
  if gov_dts_try_reuse_existing_api "$port"; then
    return 0
  fi
  ensure_tcp_port_free "$port" "$label"
}

# Vite dev server: if port responds with HTML, assume reuse.
gov_dts_try_reuse_existing_vite() {
  local port="${1:?port required}"
  GOV_DTS_REUSE_VITE_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 1
  fi
  if http_get_succeeds "http://127.0.0.1:${port}/" || http_get_succeeds "http://127.0.0.1:${port}/index.html"; then
    ok "Port $port already has a dev server responding — reusing it (no second Vite)."
    GOV_DTS_REUSE_VITE_ON_PORT=1
    return 0
  fi
  return 1
}

ensure_vite_listen_port_for_run() {
  local port="${1:?port required}"
  local label="${2:-Vite dev server}"
  GOV_DTS_REUSE_VITE_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 0
  fi
  if gov_dts_try_reuse_existing_vite "$port"; then
    return 0
  fi
  ensure_tcp_port_free "$port" "$label"
}

# Storybook: root often returns 200.
gov_dts_try_reuse_existing_storybook() {
  local port="${1:?port required}"
  GOV_DTS_REUSE_STORYBOOK_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 1
  fi
  if http_get_succeeds "http://127.0.0.1:${port}/"; then
    ok "Port $port already serves Storybook (or similar) — reusing it."
    GOV_DTS_REUSE_STORYBOOK_ON_PORT=1
    return 0
  fi
  return 1
}

ensure_storybook_listen_port_for_run() {
  local port="${1:?port required}"
  local label="${2:-Storybook dev server}"
  GOV_DTS_REUSE_STORYBOOK_ON_PORT=0
  if ! tcp_port_connects_localhost "$port"; then
    return 0
  fi
  if gov_dts_try_reuse_existing_storybook "$port"; then
    return 0
  fi
  ensure_tcp_port_free "$port" "$label"
}

# Repo root for docker compose checks (compose project). Set by run.sh.
# GOV_DTS_ROOT=/path

gov_dts_postgres_port_ready() {
  local root="${GOV_DTS_ROOT:-}"
  if [[ -n "$root" ]] && [[ -d "$root" ]]; then
    if (cd "$root" && docker compose --profile postgres ps -q postgres 2>/dev/null | grep -q .); then
      (cd "$root" && docker compose --profile postgres exec -T postgres pg_isready -h 127.0.0.1 -U postgres -d tasks) >/dev/null 2>&1 && return 0
    fi
  fi
  if command -v pg_isready >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-postgres}" pg_isready -h 127.0.0.1 -p 5432 -U postgres >/dev/null 2>&1 && return 0
  fi
  return 1
}

gov_dts_mariadb_port_ready() {
  local root="${GOV_DTS_ROOT:-}"
  if [[ -n "$root" ]] && [[ -d "$root" ]]; then
    if (cd "$root" && docker compose --profile mariadb ps -q mariadb 2>/dev/null | grep -q .); then
      (cd "$root" && docker compose --profile mariadb exec -T mariadb healthcheck.sh --connect --innodb_initialized) >/dev/null 2>&1 && return 0
    fi
  fi
  if command -v mysqladmin >/dev/null 2>&1; then
    mysqladmin ping -h 127.0.0.1 -P 3306 -uci -pci_password >/dev/null 2>&1 && return 0
    mysqladmin ping -h 127.0.0.1 -P 3306 -uroot -ppassword >/dev/null 2>&1 && return 0
  fi
  return 1
}

gov_dts_mongo_port_ready() {
  local root="${GOV_DTS_ROOT:-}"
  if [[ -n "$root" ]] && [[ -d "$root" ]]; then
    if (cd "$root" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo ps -q mongo 2>/dev/null | grep -q .); then
      (cd "$root" && docker compose -f docker-compose.yml -f docker-compose.mongodb.yml --profile mongo exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1) && return 0
    fi
  fi
  if command -v mongosh >/dev/null 2>&1; then
    mongosh --quiet "mongodb://127.0.0.1:27017" --eval "db.adminCommand('ping')" >/dev/null 2>&1 && return 0
  fi
  return 1
}

# --- Vite + native mobile SQLite (SQLCipher) ---
# VITE_MOBILE_LOCAL_DB=true requires VITE_MOBILE_DB_SECRET at build time (inlined by Vite).
# Default is for local/CI only — set VITE_MOBILE_DB_SECRET or GitHub secret for production/store builds.
GOV_DTS_MOBILE_DB_SECRET_DEFAULT="${GOV_DTS_MOBILE_DB_SECRET_DEFAULT:-gov-dts-mobile-sqlcipher-local-dev-not-for-store}"

gov_dts_export_vite_mobile_local_db_env() {
  export VITE_MOBILE_LOCAL_DB=true
  export VITE_MOBILE_DB_SECRET="${VITE_MOBILE_DB_SECRET:-$GOV_DTS_MOBILE_DB_SECRET_DEFAULT}"
}

