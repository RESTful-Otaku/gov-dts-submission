#!/usr/bin/env bash
# Build/install Android APK that uses on-device SQLite (no backend API).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"
APP_ID="uk.gov.caseworker.taskmanager"
APK_PATH="$FRONTEND/android/app/build/outputs/apk/debug/app-debug.apk"

source "$SCRIPT_DIR/lib.sh"

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

print_section "Frontend: install deps and tests"
(cd "$FRONTEND" && npm ci 2>/dev/null || npm install)
(cd "$FRONTEND" && npm run test && npm run check)

print_section "Frontend: build web assets for local SQLite mode"
(cd "$FRONTEND" && VITE_MOBILE_LOCAL_DB=true npm run build)

print_section "Capacitor: sync native projects"
(cd "$FRONTEND" && npx cap sync android)

print_section "Android: build debug APK"
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
