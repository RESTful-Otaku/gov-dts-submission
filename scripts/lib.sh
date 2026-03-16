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

