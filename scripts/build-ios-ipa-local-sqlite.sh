#!/usr/bin/env bash
# macOS only: build a signed iOS device archive and export an .ipa (local SQLite mode).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND="$ROOT/frontend"

source "$SCRIPT_DIR/lib.sh"

IPA_OUT_DEFAULT="$ROOT/gov-dts-ios-local-sqlite.ipa"
ARCHIVE_PATH_DEFAULT="$FRONTEND/ios/App/build/App.xcarchive"

IPA_OUT="${IPA_OUT:-$IPA_OUT_DEFAULT}"
ARCHIVE_PATH="${IOS_ARCHIVE_PATH:-$ARCHIVE_PATH_DEFAULT}"
EXPORT_DIR="$(dirname "$IPA_OUT")"
EXPORT_OPTIONS_PLIST="${IOS_EXPORT_OPTIONS_PLIST:-}"

usage() {
  cat >&2 <<'EOF'
Usage: ./scripts/build-ios-ipa-local-sqlite.sh --export-options-plist <path> [--ipa-out <path>] [--archive-path <path>]

Required:
  --export-options-plist <path>   Path to Xcode ExportOptions.plist (defines method/signing/team)

Optional:
  --ipa-out <path>                Output IPA path (default: ./gov-dts-ios-local-sqlite.ipa)
  --archive-path <path>           xcodebuild archive output path

Environment equivalents:
  IOS_EXPORT_OPTIONS_PLIST, IPA_OUT, IOS_ARCHIVE_PATH
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --export-options-plist)
      EXPORT_OPTIONS_PLIST="${2:?missing value for --export-options-plist}"
      shift 2
      ;;
    --ipa-out)
      IPA_OUT="${2:?missing value for --ipa-out}"
      EXPORT_DIR="$(dirname "$IPA_OUT")"
      shift 2
      ;;
    --archive-path)
      ARCHIVE_PATH="${2:?missing value for --archive-path}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script requires macOS and Xcode (xcodebuild)."
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

if [[ -z "$EXPORT_OPTIONS_PLIST" ]]; then
  fail "Missing ExportOptions.plist"
  info "Pass --export-options-plist <path> or set IOS_EXPORT_OPTIONS_PLIST."
  exit 1
fi

if [[ ! -f "$EXPORT_OPTIONS_PLIST" ]]; then
  fail "ExportOptions.plist not found: $EXPORT_OPTIONS_PLIST"
  exit 1
fi

print_section "Frontend: install, test, check"
(cd "$FRONTEND" && bun install --frozen-lockfile 2>/dev/null || bun install)
(cd "$FRONTEND" && bun run test && bun run check)

print_section "Frontend: build (local SQLite)"
gov_dts_export_vite_mobile_local_db_env
(cd "$FRONTEND" && bun run build)

print_section "Capacitor: sync iOS"
(cd "$FRONTEND" && bunx cap sync ios)

print_section "iOS: archive for device"
rm -rf "$ARCHIVE_PATH"
(cd "$FRONTEND/ios/App" && xcodebuild -project App.xcodeproj -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  archive)

if [[ ! -d "$ARCHIVE_PATH" ]]; then
  fail "Archive not created: $ARCHIVE_PATH"
  exit 1
fi

print_section "iOS: export IPA"
mkdir -p "$EXPORT_DIR"
(cd "$FRONTEND/ios/App" && xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST")

EXPORTED_IPA="$(ls -1 "$EXPORT_DIR"/*.ipa 2>/dev/null | head -1 || true)"
if [[ -z "$EXPORTED_IPA" ]]; then
  fail "No .ipa produced in $EXPORT_DIR"
  info "Check signing identities/profiles and ExportOptions.plist values."
  exit 1
fi

if [[ "$EXPORTED_IPA" != "$IPA_OUT" ]]; then
  mv -f "$EXPORTED_IPA" "$IPA_OUT"
fi

ok "iOS IPA: $IPA_OUT"
