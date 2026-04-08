#!/usr/bin/env bash
# Build, test, and run the Android app in the emulator.
# Sets up Android SDK and emulator if needed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export GOV_DTS_ROOT="${GOV_DTS_ROOT:-$ROOT}"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
source "$SCRIPT_DIR/lib.sh"

ui_banner() {
  if command -v gum >/dev/null 2>&1 && [[ -t 0 ]]; then
    gum style \
      --margin "1 0" \
      --padding "1 3" \
      --border rounded \
      --border-foreground "111" \
      --foreground "252" \
      "🤖  Android local runner" \
      "" \
      "$(gum style --foreground "244" "Builds frontend for emulator, starts API, launches Android app.")"
  else
    print_section "Android local runner"
  fi
}

run_quiet_step() {
  local label="$1"
  shift
  local log_file
  log_file="$(mktemp)"
  start_spinner "$label..."
  if "$@" >"$log_file" 2>&1; then
    stop_spinner
    ok "$label"
    rm -f "$log_file"
    return 0
  fi
  stop_spinner
  fail "$label failed"
  sed -n '1,180p' "$log_file" >&2 || true
  rm -f "$log_file"
  return 1
}

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for frontend builds (https://bun.sh)" >&2
  exit 1
fi

# Default SDK location (standard); emulator uses 10.0.2.2 to reach host's localhost
ANDROID_SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
AVD_NAME="dts_taskmanager"
API_PID=""

# Use fixed port 8081 so the emulator app (built with 10.0.2.2:8081) matches the API
EMULATOR_API_PORT=8081

# AVD hardware profile: avdmanager list device. Empty = pick the newest Pixel phone profile available.
# Example: EMULATOR_DEVICE=pixel_9
EMULATOR_DEVICE="${EMULATOR_DEVICE:-}"

# Optional *platform* skin only (has a layout file under platforms/*/skins/<name>). Examples: WXGA720, WVGA800.
# Do not use Pixel names here — modern SDK "pixel_*" dirs are overlay APKs, not emulator skins, and break startup.
EMULATOR_SKIN="${EMULATOR_SKIN:-}"

# After install, if EMULATOR_DEVICE is missing from the catalog, run sdkmanager update once (needs network).
ANDROID_AVD_REFRESH="${ANDROID_AVD_REFRESH:-1}"

# Run sdkmanager on each invocation to ensure emulator, system image, and tools (needs network).
ANDROID_SDK_ENSURE_PACKAGES="${ANDROID_SDK_ENSURE_PACKAGES:-1}"

# Set to 1 to delete and recreate the AVD when changing EMULATOR_DEVICE or after SDK updates.
FORCE_ANDROID_AVD_RECREATE="${FORCE_ANDROID_AVD_RECREATE:-0}"

# Seconds to wait for emulator ADB + sys.boot_completed after starting the AVD (default 360).
EMULATOR_BOOT_TIMEOUT_S="${EMULATOR_BOOT_TIMEOUT_S:-360}"

# Effective device id (set in setup_android_sdk)
EMULATOR_DEVICE_EFFECTIVE=""

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo "Stopping API server (pid=$API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sdkmanager_cmd() {
  local cmdline="$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager"
  [[ -x "$cmdline" ]] || cmdline="$ANDROID_SDK_DIR/cmdline-tools/bin/sdkmanager"
  if [[ -x "$cmdline" ]]; then
    "$cmdline" "$@"
  else
    return 1
  fi
}

avdmanager_cmd() {
  local cmdline="$ANDROID_SDK_DIR/cmdline-tools/latest/bin/avdmanager"
  [[ -x "$cmdline" ]] || cmdline="$ANDROID_SDK_DIR/cmdline-tools/bin/avdmanager"
  if [[ -x "$cmdline" ]]; then
    "$cmdline" "$@"
  else
    return 1
  fi
}

avd_device_in_catalog() {
  local id="$1"
  [[ -n "$id" ]] || return 1
  avdmanager_cmd list device 2>/dev/null | grep -qF "or \"${id}\""
}

# Print one line: device id to use for avdmanager create avd -d. Warns on stderr if falling back.
resolve_avd_device_id() {
  local requested="$1"
  local d

  if avd_device_in_catalog "$requested"; then
    echo "$requested"
    return 0
  fi

  if [[ "$ANDROID_AVD_REFRESH" != "0" ]]; then
    echo "Device profile \"$requested\" not found; updating cmdline-tools and emulator (retry catalog)..." >&2
    yes | sdkmanager_cmd "cmdline-tools;latest" "emulator" 2>/dev/null || true
  fi

  if avd_device_in_catalog "$requested"; then
    echo "$requested"
    return 0
  fi

  for d in \
    pixel_10 pixel_10_pro pixel_10_pro_xl pixel_10_pro_fold \
    pixel_9 pixel_9a pixel_9_pro pixel_9_pro_xl pixel_9_pro_fold \
    pixel_8 pixel_8a pixel_8_pro \
    pixel_7 pixel_7a pixel_7_pro; do
    [[ "$d" == "$requested" ]] && continue
    if avd_device_in_catalog "$d"; then
      echo "Note: \"$requested\" is not in this SDK's device catalog; using \"$d\" for AVD hardware. Update cmdline-tools/emulator, set EMULATOR_DEVICE=$d, or use FORCE_ANDROID_AVD_RECREATE=1 if the AVD already exists." >&2
      echo "$d"
      return 0
    fi
  done

  echo "Note: no Pixel device profile found; creating AVD without -d (generic)." >&2
  echo ""
}

# Pick newest Pixel phone profile present in avdmanager, or resolve explicit EMULATOR_DEVICE.
choose_emulator_device_profile() {
  local requested="${EMULATOR_DEVICE:-}"
  if [[ -n "$requested" ]]; then
    resolve_avd_device_id "$requested"
    return
  fi
  local id
  for id in \
    pixel_10_pro_xl pixel_10_pro pixel_10_pro_fold pixel_10 \
    pixel_9_pro_xl pixel_9_pro pixel_9_pro_fold pixel_9 pixel_9a \
    pixel_8_pro pixel_8 pixel_8a \
    pixel_7_pro pixel_7 pixel_7a; do
    if avd_device_in_catalog "$id"; then
      echo "Auto-selected device profile: $id (set EMULATOR_DEVICE= to override)." >&2
      echo "$id"
      return 0
    fi
  done
  resolve_avd_device_id "pixel_9"
}

# Pixel-style names in config.ini break current emulators; remove stale skin.* lines.
strip_avd_config_ini_skin_lines() {
  local avd_home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local ini="${avd_home}/${AVD_NAME}.avd/config.ini"
  [[ -f "$ini" ]] || return 0
  if ! grep -qE '^skin\.(name|path)=' "$ini" 2>/dev/null; then
    return 0
  fi
  echo "Removing stale skin.name/skin.path from AVD config (Pixel names are not valid emulator skins in current SDKs)."
  grep -vE '^skin\.(name|path)=' "$ini" > "${ini}.tmp" && mv "${ini}.tmp" "$ini"
}

# Optional platform skin (must contain a layout file). Appends -skindir/-skin to emulator args.
append_platform_skin_launch_args() {
  local -n _emu_skin_ref=$1
  local name="${EMULATOR_SKIN:-}"
  [[ -z "$name" || "$name" == "none" ]] && return 0
  local layout
  layout="$(find "$ANDROID_SDK_DIR/platforms" -path "*/skins/${name}/layout" -type f 2>/dev/null | head -1)"
  if [[ -z "$layout" ]]; then
    echo "Warning: EMULATOR_SKIN=$name has no platforms/*/skins/$name/layout — ignoring." >&2
    return 0
  fi
  local skin_folder
  skin_folder="$(dirname "$layout")"
  local skindir
  skindir="$(dirname "$skin_folder")"
  _emu_skin_ref+=(-skindir "$skindir" -skin "$name")
}

# Recreate AVD if the stored device profile no longer matches (marker or hw.device.name in config.ini).
# Marker lives under ANDROID_AVD_HOME (not inside *.avd) so it survives avdmanager delete avd.
sync_avd_with_device_profile() {
  local want="$1"
  local avd_home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  local avd_dir="${avd_home}/${AVD_NAME}.avd"
  local ini="${avd_dir}/config.ini"
  local marker="${avd_home}/.run_android_${AVD_NAME}_device"
  local prev=""
  [[ -f "$marker" ]] && prev="$(cat "$marker" 2>/dev/null || true)"
  if [[ -z "$prev" && -f "$ini" ]]; then
    prev="$(grep '^hw.device.name=' "$ini" 2>/dev/null | head -1 | cut -d= -f2 | tr -d '\r')"
  fi
  if [[ -n "$prev" && "$prev" != "$want" ]]; then
    echo "AVD was created for device=$prev; current profile is $want — recreating AVD..."
    avdmanager_cmd delete avd -n "$AVD_NAME" 2>/dev/null || true
  fi
  mkdir -p "$avd_home" 2>/dev/null || true
  echo "$want" > "$marker"
}

setup_android_sdk() {
  local need_sdk_install=0

  if [[ -d "$HOME/.config/.android/avd" ]] && [[ -d "$HOME/.config/.android/avd/${AVD_NAME}.avd" ]]; then
    export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
  fi

  if [[ -n "${ANDROID_HOME:-}" ]] && command -v adb &>/dev/null && command -v emulator &>/dev/null; then
    echo "Android SDK found at ANDROID_HOME=$ANDROID_HOME"
    ANDROID_SDK_DIR="$ANDROID_HOME"
  else
    export ANDROID_HOME="$ANDROID_SDK_DIR"
    export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/cmdline-tools/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

    if command -v adb &>/dev/null && command -v emulator &>/dev/null; then
      echo "Android SDK tools found in PATH"
    else
      need_sdk_install=1
    fi
  fi

  if [[ "$need_sdk_install" -eq 1 ]]; then
  print_section "Installing Android SDK"

  if [[ ! -x "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]] && [[ ! -x "$ANDROID_SDK_DIR/cmdline-tools/bin/sdkmanager" ]]; then
    echo "Downloading Android command-line tools..."
    mkdir -p "$ANDROID_SDK_DIR"
    local tmpdir tmpzip
    tmpdir="$(mktemp -d)"
    tmpzip="$tmpdir/cmdline-tools.zip"
    curl -fsSL -o "$tmpzip" "$CMDLINE_URL"
    unzip -q -o "$tmpzip" -d "$tmpdir"
    rm -f "$tmpzip"
    mkdir -p "$ANDROID_SDK_DIR/cmdline-tools"
    if [[ -d "$tmpdir/cmdline-tools" ]]; then
      mv "$tmpdir/cmdline-tools" "$ANDROID_SDK_DIR/cmdline-tools/latest"
    else
      local extracted
      extracted=$(find "$tmpdir" -maxdepth 1 -type d | tail -1)
      [[ -n "$extracted" ]] && mv "$extracted" "$ANDROID_SDK_DIR/cmdline-tools/latest"
    fi
    rm -rf "$tmpdir"
  fi

  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/cmdline-tools/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

  echo "Accepting SDK licenses..."
  yes | sdkmanager_cmd --licenses 2>/dev/null || true

  echo "Installing platform-tools, emulator, platform, and system image..."
  sdkmanager_cmd "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google_apis;x86_64"
  fi

  export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_DIR}"
  export ANDROID_SDK_DIR="$ANDROID_HOME"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/cmdline-tools/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

  if [[ "${ANDROID_SDK_ENSURE_PACKAGES:-1}" != "0" ]]; then
    echo "Ensuring SDK packages (cmdline-tools, emulator, API 36, Google APIs image)..."
    yes | sdkmanager_cmd "cmdline-tools;latest" "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google_apis;x86_64" 2>/dev/null || true
  fi

  EMULATOR_DEVICE_EFFECTIVE="$(choose_emulator_device_profile)"

  if [[ "${FORCE_ANDROID_AVD_RECREATE:-0}" == "1" ]] && avdmanager_cmd list avd 2>/dev/null | grep -q "$AVD_NAME"; then
    echo "Deleting existing AVD $AVD_NAME (FORCE_ANDROID_AVD_RECREATE=1)..."
    avdmanager_cmd delete avd -n "$AVD_NAME" 2>/dev/null || true
  fi

  sync_avd_with_device_profile "$EMULATOR_DEVICE_EFFECTIVE"

  if ! avdmanager_cmd list avd 2>/dev/null | grep -q "$AVD_NAME"; then
    echo "Creating AVD: $AVD_NAME (device=${EMULATOR_DEVICE_EFFECTIVE:-generic})"
    if [[ -n "$EMULATOR_DEVICE_EFFECTIVE" ]]; then
      echo "no" | avdmanager_cmd create avd -n "$AVD_NAME" -k "system-images;android-36;google_apis;x86_64" -d "$EMULATOR_DEVICE_EFFECTIVE" 2>/dev/null || \
        echo "no" | avdmanager_cmd create avd -n "$AVD_NAME" -k "system-images;android-36;google_apis;x86_64"
    else
      echo "no" | avdmanager_cmd create avd -n "$AVD_NAME" -k "system-images;android-36;google_apis;x86_64"
    fi
  fi
}

run_tests() {
  print_section "Backend: tests"
  run_quiet_step "Running backend tests" bash -c "cd \"$BACKEND\" && go test -v ./..."

  print_section "Frontend: check, test and build"
  run_quiet_step "Installing frontend dependencies" \
    bash -c "cd \"$FRONTEND\" && bun install --frozen-lockfile 2>/dev/null || bun install"
  run_quiet_step "Frontend check, test and build" \
    bash -c "cd \"$FRONTEND\" && bun run check && bun run test && bun run build"
}

# First adb serial matching emulator-* in "device" state (not offline/unauthorized).
pick_emulator_serial() {
  local line serial state
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == List* ]] && continue
    read -r serial state _ <<<"$line"
    [[ "$serial" =~ ^emulator-[0-9]+$ ]] || continue
    [[ "$state" == "device" ]] && echo "$serial" && return 0
  done < <(adb devices 2>/dev/null)
  return 1
}

# Wait until an emulator is listed as "device" and boot is complete (polls adb).
wait_for_emulator_ready() {
  local timeout_s="${1:-360}"
  local serial=""
  local i=0 boot
  adb start-server >/dev/null 2>&1 || true
  echo "Waiting for emulator ADB + boot (up to ${timeout_s}s)..." >&2
  while (( i < timeout_s )); do
    serial="$(pick_emulator_serial || true)"
    if [[ -n "$serial" ]]; then
      boot="$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
      if [[ "$boot" == "1" ]]; then
        echo "$serial"
        return 0
      fi
    fi
    sleep 2
    ((i += 2)) || true
  done
  return 1
}

run_full_stack() {
  local port=$EMULATOR_API_PORT
  # Leftover `go run ./cmd/api` on :8081 is common; auto-free unless explicitly disabled.
  if [[ -z "${GOV_DTS_FREE_PORTS:-}" ]]; then
    export GOV_DTS_FREE_PORTS=1
  fi
  ensure_tcp_port_free "$port" "API (backend for Android emulator)" || exit 1
  API_URL_EMULATOR="http://10.0.2.2:$port"

  print_section "Backend: starting API on :$port"
  (cd "$BACKEND" && HTTP_PORT="$port" go run ./cmd/api) &
  API_PID=$!
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API failed to start (port $port may be in use)."
    exit 1
  fi
  wait_for_api_ready "http://127.0.0.1:${port}" 120 "Android API" || exit 1
  echo "API running at http://localhost:$port (emulator will use $API_URL_EMULATOR)"

  print_section "Frontend: build for emulator (API=$API_URL_EMULATOR)"
  # Remote API on device (10.0.2.2); must not use on-device SQLCipher (needs VITE_MOBILE_DB_SECRET).
  run_quiet_step "Building frontend web assets" \
    bash -c "cd \"$FRONTEND\" && VITE_API_BASE=\"$API_URL_EMULATOR\" VITE_MOBILE_LOCAL_DB=false bun run build"
  run_quiet_step "Syncing Capacitor Android project" \
    bash -c "cd \"$FRONTEND\" && bunx cap sync android"

  print_section "Android: launching emulator and app"
  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  export PATH="$ANDROID_SDK_DIR/platform-tools:$ANDROID_SDK_DIR/emulator:$ANDROID_SDK_DIR/cmdline-tools/latest/bin:$PATH"
  # Gradle / Android Studio read JAVA_HOME; ANDROID_JAVA_HOME alone is not enough for the wrapper.
  export JAVA_HOME="${ANDROID_JAVA_HOME:?}"
  export PATH="$JAVA_HOME/bin:$PATH"
  # AVD may be in $HOME/.config/.android/avd on some setups (XDG)
  if [[ -d "$HOME/.config/.android/avd" ]] && [[ -d "$HOME/.config/.android/avd/${AVD_NAME}.avd" ]]; then
    export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
  fi

  strip_avd_config_ini_skin_lines

  local device=""
  device="$(pick_emulator_serial || true)"
  if [[ -z "$device" ]]; then
    echo "Starting emulator (this may take 1–3 minutes on first boot)..."
    local -a emu_args=(emulator -avd "$AVD_NAME" -no-snapshot-load -no-metrics)
    append_platform_skin_launch_args emu_args
    "${emu_args[@]}" &
    device="$(wait_for_emulator_ready "${EMULATOR_BOOT_TIMEOUT_S:-360}")" || {
      echo "Emulator did not reach ready state in time. Check: emulator -list-avds, KVM/virt, and adb devices." >&2
      exit 1
    }
    echo "Emulator ready ($device)."
  else
    echo "Using already-running emulator ($device)."
    # Ensure boot finished (cold attach)
    local boot bwait=0
    while (( bwait < 300 )); do
      boot="$(adb -s "$device" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
      [[ "$boot" == "1" ]] && break
      sleep 2
      ((bwait += 2)) || true
    done
    if [[ "$boot" != "1" ]]; then
      echo "Emulator $device is visible but not fully booted; continuing anyway (install may fail)." >&2
    fi
  fi

  export ANDROID_SERIAL="$device"
  adb -s "$device" wait-for-device

  echo "Building and installing app on emulator ($device)..."
  # Drop daemons that may have started under a different JDK before we fixed JAVA_HOME.
  (cd "$FRONTEND/android" && ./gradlew --stop >/dev/null 2>&1) || true
  (cd "$FRONTEND/android" && ./gradlew installDebug --no-daemon) || {
    echo "Gradle installDebug failed. Try: cd frontend/android && ./gradlew installDebug --stacktrace" >&2
    exit 1
  }
  echo "App installed. Launching..."
  adb -s "$device" shell am start -n uk.gov.caseworker.taskmanager/.MainActivity
  echo ""
  echo "API is still running at http://localhost:$port (for emulator: $API_URL_EMULATOR)"
  echo "Press Ctrl+C to stop the API, or close this terminal."
  wait "$API_PID"
}

# True if $1 looks like a Java 17–21 home (AGP-compatible).
java_home_supported_for_android() {
  local home="${1:?}"
  [[ -x "$home/bin/java" ]] || return 1
  local line major
  line="$("$home/bin/java" -version 2>&1 | head -1)"
  # Java 8: version "1.8.0_..."
  [[ "$line" == *"version \"1."* ]] && return 1
  if [[ "$line" =~ version\ \"([0-9]+) ]]; then
    major="${BASH_REMATCH[1]}"
  else
    return 1
  fi
  (( major >= 17 && major <= 21 ))
}

find_java17_or_21() {
  local h
  if [[ "$(uname -s)" == "Darwin" ]] && [[ -x "/usr/libexec/java_home" ]]; then
    for v in 21 17; do
      h="$(/usr/libexec/java_home -v "$v" 2>/dev/null)" || continue
      if java_home_supported_for_android "$h"; then
        echo "$h"
        return 0
      fi
    done
  fi
  if [[ -n "${JAVA_HOME:-}" ]] && java_home_supported_for_android "$JAVA_HOME"; then
    echo "$JAVA_HOME"
    return 0
  fi
  if command -v java >/dev/null 2>&1; then
    local java_exe real
    java_exe="$(command -v java)"
    if command -v realpath >/dev/null 2>&1; then
      real="$(realpath "$java_exe" 2>/dev/null || echo "$java_exe")"
    else
      real="$(readlink -f "$java_exe" 2>/dev/null || echo "$java_exe")"
    fi
    h="$(cd "$(dirname "$real")/.." && pwd)"
    if java_home_supported_for_android "$h"; then
      echo "$h"
      return 0
    fi
  fi
  for base in \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /usr/lib/jvm/zulu-21-amd64 \
    /usr/lib/jvm/zulu-17-amd64 \
    /usr/lib/jvm/zulu-21 \
    /usr/lib/jvm/zulu-17 \
    /usr/lib/jvm/java-21-openjdk-amd64 \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/java-21-openjdk \
    /usr/lib/jvm/java-17-openjdk \
    /usr/lib/jvm/jdk-21-openjdk \
    /usr/lib/jvm/jdk-17-openjdk \
    /usr/lib/jvm/jdk-21 \
    /usr/lib/jvm/jdk-17; do
    if [[ -d "$base" ]] && java_home_supported_for_android "$base"; then
      echo "$base"
      return 0
    fi
  done
  return 1
}

main() {
  ui_banner
  # Handle --install-java first
  if [[ "${1:-}" == "--install-java" ]]; then
    print_section "Installing Java 17"
    if command -v pacman &>/dev/null; then
      sudo pacman -S --noconfirm jdk17-openjdk || { echo "Install failed."; exit 1; }
    else
      echo "Install Java 17 manually, e.g. sudo pacman -S jdk17-openjdk"
      exit 1
    fi
    echo "Java 17 installed. Run ./scripts/run-android.sh again."
    exit 0
  fi

  # Check Java 17/21 (Android Gradle requires it; newer JDKs break the wrapper)
  if ! ANDROID_JAVA_HOME=$(find_java17_or_21); then
    print_section "Java 17 or 21 required"
    if command -v java &>/dev/null; then
      echo "Default java on PATH: $(java -version 2>&1 | head -1)"
    fi
    echo "The Android Gradle plugin used here requires Java 17–21 (not Java 22+)."
    echo ""
    echo "Point the script at a supported JDK, for example:"
    echo "  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk"
    echo "  export ANDROID_JAVA_HOME=\"\$JAVA_HOME\""
    echo "  ./scripts/run-android.sh"
    echo ""
    echo "Install Java 17 if needed, then run again:"
    echo "  sudo pacman -S jdk17-openjdk"
    echo ""
    echo "Or let the script install it (will prompt for sudo):"
    echo "  ./scripts/run-android.sh --install-java"
    exit 1
  fi
  export ANDROID_JAVA_HOME
  export JAVA_HOME="$ANDROID_JAVA_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"

  print_section "Setup: Android SDK"
  setup_android_sdk

  print_section "Tests"
  run_tests

  print_section "Run Android app"
  run_full_stack
}

main "$@"

