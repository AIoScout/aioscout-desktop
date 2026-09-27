#!/usr/bin/env bash
# Download pinned arduino-cli binaries for bundling.
# Layout: resources/arduino-cli/<platform>/<arch>/arduino-cli[.exe]
set -euo pipefail

VERSION="${ARDUINO_CLI_VERSION:-1.4.1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/resources/arduino-cli"
mkdir -p "$OUT"

# <os-arch-release-suffix>|<dir-platform>|<dir-arch>|<exe>
TARGETS=(
  "macOS_ARM64|darwin|arm64|arduino-cli"
  "macOS_64bit|darwin|x64|arduino-cli"
  "Windows_64bit|win32|x64|arduino-cli.exe"
)

for target in "${TARGETS[@]}"; do
  IFS='|' read -r suffix plat arch exe <<< "$target"
  dest="$OUT/$plat/$arch"
  if [ -x "$dest/$exe" ]; then
    echo "==> $plat/$arch already present, skipping"
    continue
  fi
  mkdir -p "$dest"
  ext="zip"; [ "$plat" = "darwin" ] && ext="tar.gz"
  url="https://downloads.arduino.cc/arduino-cli/arduino-cli_${VERSION}_${suffix}.${ext}"
  echo "==> fetching $url"
  tmp="$(mktemp -d)"
  curl -fSL --retry 3 -o "$tmp/cli.$ext" "$url"
  case "$ext" in
    tar.gz) tar -xzf "$tmp/cli.$ext" -C "$tmp" "$exe" ;;
    zip)    (cd "$tmp" && unzip -q -o "cli.$ext" "$exe" 2>/dev/null || unzip -q -o "cli.$ext") ;;
  esac
  mv "$tmp/$exe" "$dest/$exe"
  chmod +x "$dest/$exe"
  rm -rf "$tmp"
done

echo "==> arduino-cli $VERSION ready:"
find "$OUT" -type f -exec ls -lh {} \;
