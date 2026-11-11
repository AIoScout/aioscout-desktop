#!/usr/bin/env bash
# Assemble the sidecar resources for packaging into aioscout-desktop/resources/.
#
#   resources/mixly      — pruned mixly_lite tree (frontend + server + libs + prod deps)
#   resources/training   — PyInstaller onedir build of the AI training backend
#   resources/ai-eye-firmware — AI Eye (P4) firmware sketch templates
#      (TFLite image firmware + TFLite_Car_License plate reader)
#
# Cross-platform (macOS / Windows git-bash): uses tar for the tree copy
# instead of rsync, which is not available on Windows runners.
#
# Usage: scripts/prepare-sidecars.sh [mixly_dir] [aitraining_dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIXLY="${1:-$ROOT/../mixly_lite}"
AITRAINING="${2:-$ROOT/../Google-Teachable-Machine-TFLite-model-training/AItraining}"

RES="$ROOT/resources"
echo "==> resources root: $RES"

# ── mixly ────────────────────────────────────────────────────────────────
echo "==> [1/3] preparing mixly tree from $MIXLY"
MIXLY_OUT="$RES/mixly"
rm -rf "$MIXLY_OUT"
mkdir -p "$MIXLY_OUT"

# Board bundles must be current (they're gitignored build output) and need
# the source tree's dev dependencies (webpack) to build.
if [ ! -f "$MIXLY/boards/default/arduino_esp32/main.bundle.js" ]; then
  echo "    board bundle missing — building it first"
  (cd "$MIXLY" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run deps && npm run build:boards:arduino)
fi

# tar-based copy with excludes (bsdtar on macOS and Windows both support this)
tar -cf - \
  --exclude './.git*' \
  --exclude './node_modules' \
  --exclude './boards/default_src' \
  --exclude './boards/extend' \
  --exclude './boards/HDK' \
  --exclude './boards/default/micropython_*' \
  --exclude './boards/default/python_*' \
  --exclude './boards/default/arduino_avr' \
  --exclude './boards/default/arduino_esp8266' \
  --exclude './boards/default/arduino' \
  --exclude './.build_output' \
  --exclude './sketch_build' \
  --exclude './libraries' \
  --exclude './.model_uploads' \
  --exclude './static-server' \
  --exclude './scripts' \
  --exclude './.github' \
  --exclude './.claude' \
  --exclude '*.log' \
  -C "$MIXLY" . | tar -xf - -C "$MIXLY_OUT"

echo "    installing production dependencies"
(cd "$MIXLY_OUT" && npm install --omit=dev --no-audit --no-fund --ignore-scripts)
# Re-approve native install scripts in case the local npm gates them.
(cd "$MIXLY_OUT" && npm approve-scripts --allow-scripts-pending 2>/dev/null || true)

# ── training backend ─────────────────────────────────────────────────────
echo "==> [2/3] preparing training backend from $AITRAINING"
TRAIN_OUT="$RES/training"
rm -rf "$TRAIN_OUT"
mkdir -p "$TRAIN_OUT"

if [ ! -d "$AITRAINING/dist/TFLiteTraining" ]; then
  echo "    PyInstaller build missing — building (this takes ~5-10 min)"
  (cd "$AITRAINING" && python -m PyInstaller --clean --noconfirm TFLiteTraining.spec)
fi

cp -R "$AITRAINING/dist/TFLiteTraining" "$TRAIN_OUT/TFLiteTraining"

# ── AI Eye firmware sketches ─────────────────────────────────────────────
# Templates for the P4 burn chain. The desktop app materializes writable
# copies under userData and points the mixly server / training backend at
# them, so Export Model + Compile & Upload work out of the box. Source dirs
# default to the sibling checkouts (the CI workspace uses the same layout);
# override with AI_EYE_TFLITE_SRC / AI_EYE_SIGN_SRC.
echo "==> [3/4] preparing AI Eye firmware sketches"
AI_EYE_OUT="$RES/ai-eye-firmware"
rm -rf "$AI_EYE_OUT"
mkdir -p "$AI_EYE_OUT"
TFLITE_SRC="${AI_EYE_TFLITE_SRC:-$ROOT/../Google-Teachable-Machine-TFLite-model-training/TFLite}"
SIGN_SRC="${AI_EYE_SIGN_SRC:-$ROOT/../TFLite_Car_License}"
if [ ! -f "$TFLITE_SRC/TFLite.ino" ]; then
    echo "    WARNING: image firmware sketch missing at $TFLITE_SRC — AI Eye image burn will be unavailable"
fi
if [ ! -f "$SIGN_SRC/TFLite_Sign.ino" ]; then
    echo "    WARNING: plate reader sketch missing at $SIGN_SRC — AI Eye plate burn will be unavailable"
fi
# tar copy (same pattern as the mixly tree) so repo metadata (.git) and
# stray junk stay out of the package.
tar -cf - --exclude './.git*' --exclude '* copy.txt' -C "$TFLITE_SRC" . | tar -xf - -C "$AI_EYE_OUT/TFLite"
tar -cf - --exclude './.git*' --exclude '* copy.txt' -C "$SIGN_SRC" . | tar -xf - -C "$AI_EYE_OUT/TFLite_Car_License"

echo "==> [4/4] done"
du -sh "$MIXLY_OUT" "$TRAIN_OUT" "$AI_EYE_OUT"
