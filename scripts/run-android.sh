#!/usr/bin/env bash
# Build, test, and run the Android app in the emulator.
# Sets up Android SDK and emulator if needed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
source "$SCRIPT_DIR/lib.sh"
# Default SDK location (standard); emulator uses 10.0.2.2 to reach host's localhost
ANDROID_SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
AVD_NAME="dts_taskmanager"
API_PID=""

# Use fixed port 8080 so the emulator app (built with 10.0.2.2:8080) matches the API
EMULATOR_API_PORT=8080

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    echo "Stopping API server (pid=$API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM

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

setup_android_sdk() {
  if [[ -n "${ANDROID_HOME:-}" ]] && command -v adb &>/dev/null && command -v emulator &>/dev/null; then
    echo "Android SDK found at ANDROID_HOME=$ANDROID_HOME"
    return 0
  fi

  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

  if command -v adb &>/dev/null && command -v emulator &>/dev/null; then
    echo "Android SDK tools found in PATH"
    return 0
  fi

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

  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

  echo "Accepting SDK licenses..."
  yes | sdkmanager_cmd --licenses 2>/dev/null || true

  echo "Installing platform-tools, emulator, platform, and system image..."
  sdkmanager_cmd "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google_apis;x86_64"

  if ! avdmanager_cmd list avd 2>/dev/null | grep -q "$AVD_NAME"; then
    echo "Creating AVD: $AVD_NAME"
    echo "no" | avdmanager_cmd create avd -n "$AVD_NAME" -k "system-images;android-36;google_apis;x86_64" -d "pixel_7" 2>/dev/null || \
      echo "no" | avdmanager_cmd create avd -n "$AVD_NAME" -k "system-images;android-36;google_apis;x86_64"
  fi
}

run_tests() {
  print_section "Backend: tests"
  (cd "$BACKEND" && go test -v ./...)

  print_section "Frontend: check and build"
  (cd "$FRONTEND" && npm ci 2>/dev/null || npm install)
  (cd "$FRONTEND" && npm run check && npm run build)
}

run_full_stack() {
  local port=$EMULATOR_API_PORT
  if (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
    echo "Port $port is in use. Stop the process using it, or run: lsof -i :$port"
    exit 1
  fi
  API_URL_EMULATOR="http://10.0.2.2:$port"

  print_section "Backend: starting API on :$port"
  (cd "$BACKEND" && HTTP_PORT="$port" go run ./cmd/api) &
  API_PID=$!
  sleep 3
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API failed to start (port $port may be in use)."
    exit 1
  fi
  echo "API running at http://localhost:$port (emulator will use $API_URL_EMULATOR)"

  print_section "Frontend: build for emulator (API=$API_URL_EMULATOR)"
  (cd "$FRONTEND" && VITE_API_BASE="$API_URL_EMULATOR" npm run build)
  (cd "$FRONTEND" && npx cap sync)

  print_section "Android: launching emulator and app"
  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
  export PATH="$ANDROID_SDK_DIR/platform-tools:$ANDROID_SDK_DIR/emulator:$ANDROID_SDK_DIR/cmdline-tools/latest/bin:$PATH"
  # AVD may be in $HOME/.config/.android/avd on some setups (XDG)
  if [[ -d "$HOME/.config/.android/avd" ]] && [[ -d "$HOME/.config/.android/avd/${AVD_NAME}.avd" ]]; then
    export ANDROID_AVD_HOME="$HOME/.config/.android/avd"
  fi

  # Start emulator in background if not already running
  if ! adb devices 2>/dev/null | grep -q emulator; then
    echo "Starting emulator (this may take 1–2 minutes on first boot)..."
    emulator -avd "$AVD_NAME" -no-snapshot-load -no-metrics &
    local emu_pid=$!
    echo "Waiting for emulator to boot..."
    adb wait-for-device
    while true; do
      local boot
      boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
      [[ "$boot" == "1" ]] && break
      sleep 2
    done
    echo "Emulator ready."
  else
    echo "Emulator already running."
  fi

  echo "Building and installing app on emulator..."
  local device
  device=$(adb devices | grep -E 'emulator-[0-9]+' | head -1 | awk '{print $1}')
  if [[ -z "$device" ]]; then
    echo "No emulator device found. Run with device connected."
    exit 1
  fi
  export JAVA_HOME="${ANDROID_JAVA_HOME:-}"
  # Build and install APK via Gradle (ensures app is installed on device)
  (cd "$FRONTEND/android" && ./gradlew installDebug)
  echo "App installed. Launching..."
  adb -s "$device" shell am start -n uk.gov.caseworker.taskmanager/.MainActivity
  echo ""
  echo "API is still running at http://localhost:$port (for emulator: $API_URL_EMULATOR)"
  echo "Press Ctrl+C to stop the API, or close this terminal."
  wait "$API_PID"
}

find_java17_or_21() {
  local java_home=""
  if [[ -n "${JAVA_HOME:-}" ]] && [[ -x "${JAVA_HOME}/bin/java" ]]; then
    local ver
    ver=$("${JAVA_HOME}/bin/java" -version 2>&1 | head -1)
    if [[ "$ver" =~ "17" ]] || [[ "$ver" =~ "21" ]]; then
      echo "$JAVA_HOME"
      return 0
    fi
  fi
  for base in /usr/lib/jvm/zulu-21 /usr/lib/jvm/zulu-17 /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/jdk-21 /usr/lib/jvm/jdk-17; do
    if [[ -d "$base" ]] && [[ -x "$base/bin/java" ]]; then
      echo "$base"
      return 0
    fi
  done
  return 1
}

main() {
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

  # Check Java 17/21 (Android Gradle requires it; Java 25 is not supported)
  if ! ANDROID_JAVA_HOME=$(find_java17_or_21); then
    print_section "Java 17 or 21 required"
    echo "The Android build requires Java 17 or 21. Java 25 is not supported."
    echo ""
    echo "Install Java 17, then run this script again:"
    echo "  sudo pacman -S jdk17-openjdk"
    echo ""
    echo "Or let the script install it (will prompt for sudo):"
    echo "  ./scripts/run-android.sh --install-java"
    exit 1
  fi
  export ANDROID_JAVA_HOME

  print_section "Setup: Android SDK"
  setup_android_sdk

  print_section "Tests"
  run_tests

  print_section "Run Android app"
  run_full_stack
}

main "$@"

