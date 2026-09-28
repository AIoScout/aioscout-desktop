#!/usr/bin/env bash
# Build a pre-seeded Arduino15 data directory (esp32 core incl. its bundled
# TFLiteMicro) so classroom machines never need network access.
#
# Produces: resources/Arduino15-seed/<platform>/<arch>/Arduino15
# The app copies it to userData/Arduino15 on first launch.
#
# Toolchain binaries are platform-specific — run this on each target OS
# (macOS here; the Windows seed is built by CI on a windows runner).
set -euo pipefail

VERSION="${ESP32_CORE_VERSION:-3.3.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/resources/Arduino15-seed"

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) plat=darwin; arch=arm64 ;;
  Darwin/x86_64) plat=darwin; arch=x64 ;;
  MINGW*/AMD64|CYGWIN*/AMD64) plat=win32; arch=x64 ;;
  *) echo "unsupported platform: $(uname -s)/$(uname -m)"; exit 1 ;;
esac

dest="$OUT/$plat/$arch"
cli="$ROOT/resources/arduino-cli/$plat/$arch/$( [ "$plat" = win32 ] && echo arduino-cli.exe || echo arduino-cli )"
if [ ! -x "$cli" ]; then
  echo "arduino-cli not bundled yet — run scripts/fetch-arduino-cli.sh first"; exit 1
fi

echo "==> seeding Arduino15 for $plat/$arch at $dest"
rm -rf "$dest"
mkdir -p "$dest/Arduino15"

# arduino-cli 1.x has no --config flag; directory overrides come via env vars.
# Downloads (the ~1GB tarball cache) go OUTSIDE the seed so installers don't
# ship them, and are removed afterwards.
export ARDUINO_DIRECTORIES_DATA="$dest/Arduino15"
export ARDUINO_DIRECTORIES_DOWNLOADS="$dest/downloads"
rm -rf "$dest/downloads"

"$cli" core update-index
"$cli" core install "esp32:esp32@$VERSION"
rm -rf "$dest/downloads"

echo "==> verifying S3 compile capability"
"$cli" core list

du -sh "$dest/Arduino15"
