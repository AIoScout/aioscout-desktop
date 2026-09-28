#!/usr/bin/env bash
# Assemble the sidecar resources for packaging into aioscout-desktop/resources/.
#
#   resources/mixly      — pruned mixly_lite tree (frontend + server + libs + prod deps)
#   resources/training   — PyInstaller onedir build of the AI training backend
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

echo "==> [3/3] done"
du -sh "$MIXLY_OUT" "$TRAIN_OUT"
