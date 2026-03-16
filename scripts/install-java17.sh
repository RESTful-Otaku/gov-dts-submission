#!/usr/bin/env bash
# Install Java 17 for Android build. Prefers Azul Zulu, falls back to OpenJDK.
set -euo pipefail

print_section() {
  printf '\n\033[1m=== %s ===\033[0m\n' "$1"
}

install_zulu_aur() {
  if command -v paru &>/dev/null; then
    paru -S zulu-17-bin --noconfirm
    return 0
  fi
  if command -v yay &>/dev/null; then
    yay -S zulu-17-bin --noconfirm
    return 0
  fi
  # Manual AUR build
  local tmp
  tmp=$(mktemp -d)
  git clone https://aur.archlinux.org/zulu-17-bin.git "$tmp/zulu-17-bin"
  (cd "$tmp/zulu-17-bin" && makepkg -si)
  rm -rf "$tmp"
}

install_openjdk() {
  sudo pacman -S --noconfirm jdk17-openjdk
}

main() {
  print_section "Installing Java 17"
  echo "Attempting Azul Zulu 17 (AUR) or OpenJDK 17 (pacman)..."
  if install_zulu_aur 2>/dev/null; then
    echo "Azul Zulu 17 installed."
  else
    echo "Falling back to jdk17-openjdk..."
    install_openjdk
  fi
  archlinux-java status
  echo ""
  echo "Run: ./scripts/run-android.sh"
}

main "$@"

