#!/usr/bin/env bash
# Prepare the iOS Capacitor project on Linux (no Xcode): web build + cap sync ios.
# To obtain an installable iOS Simulator .app.zip, trigger the GitHub Actions workflow
# "iOS Simulator (local SQLite artifact)" and download the artifact from the run page.
#
# Online emulators vary: many expect a Simulator .app (this workflow) or a hosted build;
# device .ipa builds require Apple codesigning and are not produced here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"

source "$SCRIPT_DIR/lib.sh"

if [[ "$(uname -s)" == "Darwin" ]]; then
  info "You are on macOS — you can build the zip locally with:"
  info "  ./scripts/build-ios-simulator-local-sqlite.sh"
  info "Or run the app in the simulator:"
  info "  ./scripts/run-ios.sh --local-sqlite"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required (https://bun.sh)" >&2
  exit 1
fi

print_section "Frontend: install, test, check"
(cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install)
(cd "$FRONTEND" && bun run test && bun run check)

print_section "Frontend: build web assets (local SQLite)"
(cd "$FRONTEND" && VITE_MOBILE_LOCAL_DB=true bun run build)

print_section "Capacitor: sync iOS project (updates frontend/ios)"
(cd "$FRONTEND" && bunx cap sync ios)

ok "iOS project under frontend/ios is ready for Xcode (on macOS) or CI."
info "iOS native deps are SwiftPM (CapApp-SPM); bun install runs postinstall patches for @capacitor-community/sqlite."

print_section "Get iOS Simulator .app.zip on Linux"
info "Apple does not provide Xcode for Linux — you cannot compile the .app locally."
info "Use GitHub Actions:"
info "  1. Push these changes to your fork/origin."
info "  2. Actions → \"iOS Simulator (local SQLite artifact)\" → Run workflow."
info "  3. When the job finishes, open the run → Artifacts → download ios-simulator-local-sqlite-app."
info "CLI (if gh is installed and authenticated):"
info "  gh workflow run ios-simulator-local-sqlite.yml"
info "  gh run watch"
info "  gh run download -n ios-simulator-local-sqlite-app"
