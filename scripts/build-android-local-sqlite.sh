#!/usr/bin/env bash
# Build/install Android APK that uses on-device SQLite (no backend API).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"
APP_ID="uk.gov.caseworker.taskmanager"
APK_PATH="$FRONTEND/android/app/build/outputs/apk/debug/app-debug.apk"

source "$SCRIPT_DIR/lib.sh"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for frontend builds (https://bun.sh)" >&2
  exit 1
fi

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

if ! ANDROID_JAVA_HOME=$(find_java17_or_21); then
  fail "Java 17 or 21 is required for Android build."
  info "Install with: sudo pacman -S jdk17-openjdk"
  exit 1
fi
export JAVA_HOME="$ANDROID_JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

ANDROID_DIR="$FRONTEND/android"
LOCAL_PROPS="$ANDROID_DIR/local.properties"

android_sdk_dir_looks_valid() {
  local d="${1:-}"
  [[ -n "$d" && -d "$d" ]] || return 1
  [[ -d "$d/platform-tools" || -d "$d/build-tools" || -d "$d/platforms" ]]
}

read_sdk_dir_from_local_properties() {
  [[ -f "$LOCAL_PROPS" ]] || return 1
  local line
  line="$(grep -E '^sdk\.dir=' "$LOCAL_PROPS" 2>/dev/null | tail -1)"
  [[ -n "$line" ]] || return 1
  local raw="${line#sdk.dir=}"
  raw="${raw%$'\r'}"
  # Unescape Windows-style paths from Android Studio (sdk.dir=C\:\\Users\\...)
  raw="${raw//\\\\/\\}"
  printf '%s' "$raw"
}

resolve_android_sdk() {
  if android_sdk_dir_looks_valid "${ANDROID_HOME:-}"; then
    printf '%s' "$ANDROID_HOME"
    return 0
  fi
  if android_sdk_dir_looks_valid "${ANDROID_SDK_ROOT:-}"; then
    printf '%s' "$ANDROID_SDK_ROOT"
    return 0
  fi
  local from_props
  if from_props="$(read_sdk_dir_from_local_properties)" && android_sdk_dir_looks_valid "$from_props"; then
    printf '%s' "$from_props"
    return 0
  fi
  local cand
  for cand in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" /opt/android-sdk; do
    if android_sdk_dir_looks_valid "$cand"; then
      printf '%s' "$cand"
      return 0
    fi
  done
  return 1
}

ensure_local_properties_sdk_dir() {
  local sdk="$1"
  if [[ -f "$LOCAL_PROPS" ]] && grep -qE '^sdk\.dir=' "$LOCAL_PROPS"; then
    return 0
  fi
  mkdir -p "$ANDROID_DIR"
  if [[ -f "$LOCAL_PROPS" ]]; then
    printf '\nsdk.dir=%s\n' "$sdk" >>"$LOCAL_PROPS"
  else
    printf 'sdk.dir=%s\n' "$sdk" >"$LOCAL_PROPS"
  fi
  info "Wrote sdk.dir to $LOCAL_PROPS (gitignored)."
}

print_section "Frontend: install deps and tests"
(cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install)
(cd "$FRONTEND" && bun run test && bun run check)

print_section "Frontend: build web assets for local SQLite mode"
(cd "$FRONTEND" && VITE_MOBILE_LOCAL_DB=true bun run build)

print_section "Capacitor: sync native projects"
(cd "$FRONTEND" && bunx cap sync android)

print_section "Android: build debug APK"
if ! ANDROID_SDK_DIR="$(resolve_android_sdk)"; then
  fail "Android SDK not found (Gradle needs ANDROID_HOME or sdk.dir in local.properties)."
  info "Typical install: Android Studio → SDK at ~/Android/Sdk"
  info "Then either: export ANDROID_HOME=\$HOME/Android/Sdk"
  info "Or add one line to $LOCAL_PROPS:"
  info "  sdk.dir=/path/to/Android/Sdk"
  info "Arch package hint: android-sdk (set ANDROID_HOME to the package SDK path)."
  exit 1
fi
export ANDROID_HOME="$ANDROID_SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
ensure_local_properties_sdk_dir "$ANDROID_SDK_DIR"
info "Using Android SDK: $ANDROID_SDK_DIR"
(cd "$FRONTEND/android" && ./gradlew assembleDebug)

if [[ ! -f "$APK_PATH" ]]; then
  fail "APK not found at expected path: $APK_PATH"
  exit 1
fi
ok "APK built: $APK_PATH"

if command -v adb >/dev/null 2>&1; then
  device_count="$(adb devices | awk 'NR>1 && $2=="device"{count++} END{print count+0}')"
  if [[ "$device_count" -gt 0 ]]; then
    print_section "Android: install and launch on connected device"
    adb install -r "$APK_PATH"
    adb shell am start -n "$APP_ID/.MainActivity"
    ok "App launched on connected Android device."
    info "SQLite DB is created on first app start at:"
    info "/data/data/$APP_ID/databases/taskmanagerSQLite.db"
  else
    info "No connected Android device detected. Connect your phone and run:"
    info "adb install -r $APK_PATH"
  fi
else
  info "adb is not available; skipping install."
fi

print_section "Done"
echo "APK ready at: $APK_PATH"
