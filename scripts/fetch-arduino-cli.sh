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
  if [ "$ext" = "tar.gz" ]; then
    tar -xzf "$tmp/cli.$ext" -C "$tmp"
  else
    # git-bash's tar is GNU tar (cannot read zip); Windows' own bsdtar can.
    if [ -x /c/Windows/System32/tar.exe ]; then
      /c/Windows/System32/tar.exe -xf "$tmp/cli.$ext" -C "$tmp"
    else
      unzip -q -o "$tmp/cli.$ext" -d "$tmp"
    fi
  fi
  mv "$tmp/$exe" "$dest/$exe"
  chmod +x "$dest/$exe" 2>/dev/null || true
  rm -rf "$tmp"
done

echo "==> arduino-cli $VERSION ready:"
find "$OUT" -type f -exec ls -lh {} \;
