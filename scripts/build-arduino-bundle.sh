#!/usr/bin/env bash
# Build a pre-seeded Arduino15 data directory (esp32 core incl. its bundled
# TFLite Micro) so classroom machines never need network access.
#
# Produces: resources/Arduino15-seed/<platform>/<arch>/Arduino15
# The app copies it to userData/Arduino15 on first launch.
#
# The seed is pruned to the boards we actually ship — ESP32-S3 (sensors/body)
# and ESP32-P4 (AI Eye) — which cuts it roughly in half (other chips' libs,
# unused gcc multilibs, debuggers). A representative sketch is compiled for
# both boards at the end to prove the pruned toolchain still works.
#
# Toolchain binaries are platform-specific — run this on each target OS
# (macOS here; the Windows seed is built by CI on a windows runner).
set -euo pipefail

VERSION="${ESP32_CORE_VERSION:-3.3.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIXLY_DIR="${MIXLY_DIR:-$ROOT/../mixly_lite}"
OUT="$ROOT/resources/Arduino15-seed"

case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) plat=darwin; arch=arm64 ;;
  Darwin/x86_64) plat=darwin; arch=x64 ;;
  MINGW*/*|MSYS*/*|CYGWIN*/*)
    case "$(uname -m)" in
      x86_64|AMD64) arch=x64 ;;
      *) echo "unsupported windows arch: $(uname -m)"; exit 1 ;;
    esac
    plat=win32 ;;
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
# ship them, and are removed afterwards. On git-bash, convert to Windows
# paths explicitly — don't rely on MSYS auto-conversion of env vars.
to_native() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi
}
export ARDUINO_DIRECTORIES_DATA="$(to_native "$dest/Arduino15")"
export ARDUINO_DIRECTORIES_DOWNLOADS="$(to_native "$dest/downloads")"
rm -rf "$dest/downloads"

"$cli" core update-index
"$cli" core install "esp32:esp32@$VERSION"
rm -rf "$dest/downloads"

# ── Prune to S3 + P4 ──────────────────────────────────────────────────────
echo "==> pruning toolchain to esp32s3 + esp32p4"
PKG="$dest/Arduino15/packages/esp32"

# Precompiled IDF libs: keep only the two chips (~170MB saved per dropped chip).
for idf in "$PKG"/tools/esp32-arduino-libs/*/; do
  for chip in esp32 esp32c3 esp32c5 esp32c6 esp32h2 esp32s2; do
    rm -rf "$idf$chip"
  done
done

# RISC-V toolchain (P4 = rv32imafc_zicsr_zifencei/ilp32f): drop the other
# gcc multilib variants (~840MB in the toolchain + ~460MB in picolibc).
for rv in "$PKG"/tools/esp-rv32/*/; do
  for v in rv32i_zicsr_zifencei rv32imc_zicsr_zifencei rv32imac_zicsr_zifencei \
           rv32imafc_zicsr_zifencei_zba_zbb_zbc_zbs; do
    rm -rf "$rv/riscv32-esp-elf/lib/$v" "$rv/picolibc/riscv32-esp-elf/lib/$v"
  done
done

# Xtensa toolchain (S3): drop the esp32 / esp32s2 multilibs.
for x in "$PKG"/tools/esp-x32/*/; do
  rm -rf "$x/xtensa-esp-elf/lib/esp32" "$x/xtensa-esp-elf/lib/esp32s2"
  rm -rf "$x/picolibc/xtensa-esp-elf/lib/esp32" "$x/picolibc/xtensa-esp-elf/lib/esp32s2"
done

# Debuggers (gdb/openocd) are not used for compile/upload.
rm -rf "$PKG"/tools/riscv32-esp-elf-gdb "$PKG"/tools/xtensa-esp-elf-gdb "$PKG"/tools/openocd-esp32

du -sh "$dest/Arduino15"

# ── Verify: compile a representative sketch for BOTH boards ───────────────
echo "==> verification compiles (S3 + P4)"
VERIF="$(mktemp -d)"
mkdir -p "$VERIF/verify" "$VERIF/libraries"
cp -R "$MIXLY_DIR/SmartCar" "$VERIF/libraries/SmartCar"
cp -R "$MIXLY_DIR/Mixly_TFLite" "$VERIF/libraries/Mixly_TFLite"
# NB: arduino-cli requires the .ino filename to match its parent dir name.
cat > "$VERIF/verify/verify.ino" <<'EOF'
#include <SmartCar.h>
#include <Mixly_TFLite.h>
void setup() {
  Serial.begin(115200);
  AIVision::InitEye(96, 96, g_model_data, g_model_data_len, true);
}
void loop() {
  Movement::MoveForward();
  if (AIVision::HasNewResult()) {
    auto r = AIVision::Predict();
    Serial.println(r.label);
    AIVision::SendResult();
  }
  Movement::Stop();
}
EOF
"$cli" compile -b esp32:esp32:esp32s3 --libraries "$VERIF/libraries" "$VERIF/verify" --build-path "$VERIF/build-s3"
"$cli" compile -b esp32:esp32:esp32p4 --libraries "$VERIF/libraries" "$VERIF/verify" --build-path "$VERIF/build-p4"
rm -rf "$VERIF"
echo "==> seed verified"
