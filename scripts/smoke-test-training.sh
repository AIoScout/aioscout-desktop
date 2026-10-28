#!/usr/bin/env bash
# Smoke-test the PyInstaller-built training backend before packaging. Two
# stages:
#
#   1. Static import check (scripts/check-bundle-imports.py): every import in
#      the app modules that ship as data must resolve inside the bundle —
#      PyInstaller never analyzes those imports, so a module missing from
#      TFLiteTraining.spec datas builds fine and only crashes when the
#      training panel first opens.
#   2. Headless boot check: run the console binary the way the desktop app
#      does (TFLiteTrainingConsole --headless), wait for its single stdout
#      line {"type": "aioscout:ready", "port": <n>, "pid": <n>}, probe the
#      reported port once, then shut the process tree down. Catches launcher
#      and multiprocessing-child crashes. The console binary is used instead
#      of the windowed one so crashes surface as text instead of a modal
#      dialog hanging the runner; on macOS frozen builds it is also the
#      multiprocessing spawn helper.
#
# Cross-platform (macOS / Windows git-bash). Stage 1 needs PyInstaller
# importable — set PYTHON to the interpreter that built the bundle when
# running it outside CI (CI reuses the setup-python interpreter).
#
# Usage: scripts/smoke-test-training.sh <dist/TFLiteTraining dir>
#   SMOKE_TIMEOUT_S  overall boot deadline, default 300 s. The launcher
#                    itself allows Streamlit 180 s, so >180 gives it room to
#                    report its own error rather than a bare script timeout.
set -euo pipefail

DIST_DIR=${1:?usage: smoke-test-training.sh <dist/TFLiteTraining dir>}
TIMEOUT_S=${SMOKE_TIMEOUT_S:-300}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

EXE_SUFFIX=""
if [[ "${OSTYPE:-}" == msys* || "${OS:-}" == "Windows_NT" ]]; then
  EXE_SUFFIX=".exe"
fi
BIN="$DIST_DIR/TFLiteTrainingConsole$EXE_SUFFIX"
if [[ ! -x "$BIN" ]]; then
  echo "smoke: FAIL — missing $BIN" >&2
  exit 2
fi

# ── stage 1: static import completeness ──────────────────────────────────
PYBIN="${PYTHON:-}"
if [[ -z "$PYBIN" ]]; then
  if command -v python >/dev/null 2>&1; then PYBIN=python; else PYBIN=python3; fi
fi
"$PYBIN" "$SCRIPT_DIR/check-bundle-imports.py" "$DIST_DIR"

OUT="$(mktemp -t smoke-training)"
START=$(date +%s)

dump_output() {
  echo "----- backend output (last 40 lines) -----" >&2
  tail -40 "$OUT" >&2
  # The launcher's startup errors name the streamlit log; show it if reachable.
  local logpath
  logpath="$(sed -n 's/.*Log: \([^) ]*\).*/\1/p' "$OUT" | tail -1)"
  if [[ -n "$logpath" && -f "$logpath" ]]; then
    echo "----- streamlit log: $logpath (last 40 lines) -----" >&2
    tail -40 "$logpath" >&2
  fi
}

kill_tree() {
  local pid=$1
  if [[ -n "$EXE_SUFFIX" ]]; then
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
  else
    # SIGTERM lets the launcher reap its streamlit child gracefully.
    kill -TERM "$pid" 2>/dev/null || true
    local i
    for i in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || return 0
      sleep 1
    done
    kill -KILL "$pid" 2>/dev/null || true
  fi
}

"$BIN" --headless >"$OUT" 2>&1 &
PID=$!
trap 'kill_tree "$PID" >/dev/null 2>&1 || true' EXIT

PORT=""
while (($(date +%s) - START < TIMEOUT_S)); do
  if ! kill -0 "$PID" 2>/dev/null; then
    local_code=0
    wait "$PID" || local_code=$?
    echo "smoke: FAIL — backend exited before ready (code $local_code)" >&2
    dump_output
    exit 1
  fi
  line="$(grep -m1 'aioscout:ready' "$OUT" || true)"
  if [[ -n "$line" ]]; then
    PORT="$(sed -n 's/.*"port": *\([0-9][0-9]*\).*/\1/p' <<<"$line")"
    if [[ -n "$PORT" ]]; then
      break
    fi
  fi
  sleep 1
done

if [[ -z "$PORT" ]]; then
  echo "smoke: FAIL — no aioscout:ready line within ${TIMEOUT_S}s" >&2
  dump_output
  exit 1
fi

# Belt and braces: the launcher only prints ready after Streamlit answered
# HTTP, but this also catches "ready line printed, server died instantly".
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  "http://127.0.0.1:${PORT}/" 2>>"$OUT" || true)"
HTTP_CODE="${HTTP_CODE//[^0-9]/}"
HTTP_CODE="${HTTP_CODE:-0}"
if ((HTTP_CODE == 0 || HTTP_CODE >= 500)); then
  echo "smoke: FAIL — port $PORT answered HTTP $HTTP_CODE" >&2
  dump_output
  exit 1
fi

ELAPSED=$(( $(date +%s) - START ))
echo "smoke: OK — backend ready on port $PORT after ${ELAPSED}s (HTTP $HTTP_CODE); shutting down"
kill_tree "$PID"
