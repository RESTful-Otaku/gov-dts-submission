#!/usr/bin/env bash
# macOS only: build iOS Simulator .app with on-device SQLite and zip it next to this repo root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"
ZIP_OUT="$ROOT/gov-dts-ios-simulator-local-sqlite.app.zip"
APP_PATH="$FRONTEND/ios/App/build/Build/Products/Release-iphonesimulator/App.app"

source "$SCRIPT_DIR/lib.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script requires macOS and Xcode (xcodebuild)."
  info "On Linux, run: ./scripts/prepare-ios-local-sqlite-linux.sh"
  info "Then use GitHub Actions workflow: ios-simulator-local-sqlite.yml"
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  fail "xcodebuild not found. Install Xcode command-line tools."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  fail "bun is required (https://bun.sh)"
  exit 1
fi

print_section "Frontend: install, test, check"
(cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install)
(cd "$FRONTEND" && bun run test && bun run check)

print_section "Frontend: build (local SQLite)"
(cd "$FRONTEND" && VITE_MOBILE_LOCAL_DB=true bun run build)

print_section "Capacitor: sync iOS"
(cd "$FRONTEND" && bunx cap sync ios)

print_section "iOS Simulator: xcodebuild (SPM, same flags as CI mobile-builds)"
# Apple Silicon: arm64 simulator only — SQLCipher SPM xcframework often has no x86_64 simulator slice.
# On Intel Macs, drop ARCHS/EXCLUDED_ARCHS if you need x86_64 sim (may fail to link SQLCipher).
(cd "$FRONTEND/ios/App" && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Release build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO \
  -derivedDataPath build \
  ARCHS=arm64 \
  'EXCLUDED_ARCHS[sdk=iphonesimulator*]'=x86_64)

if [[ ! -d "$APP_PATH" ]]; then
  fail "App bundle not found: $APP_PATH"
  exit 1
fi

print_section "Zip"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_OUT"
ok "Simulator app zip: $ZIP_OUT"
