# AIoScout Desktop

The unified AIoScout desktop app — one entry point with two linked subpages:

- **AI Training** — the TF Lite model training app (Python backend, embedded as a headless subprocess)
- **Block Coding** — the Mixly-based block editor (Node backend, embedded in-process) with pre-configured Arduino CLI upload to the AIoScout smart car

Trained models flow from the training page straight into the block editor's AI Vision blocks.

## Architecture

```
aioscout-desktop (Electron shell)
├── main process
│   ├── services/mixly.ts     — forks ../mixly_lite/server.js (ELECTRON_RUN_AS_NODE)
│   ├── services/training.ts  — spawns the AItraining Python launcher --headless
│   └── windowManager.ts      — sandboxed WebContentsViews per subpage (no nodeIntegration:
│                               the mixly frontend must stay in web/web-socket mode)
├── renderer (shell UI, DESIGN.md visual language)
└── preload (contextBridge IPC)
```

Both backends bind ephemeral loopback ports; the shell learns the ports via an
IPC message (mixly) and a stdout JSON line (training), then points the
WebContentsViews at them.

## Dev setup

Requires sibling checkouts of [`mixly_lite`](../mixly_lite) (branch
`feat/tflite-model-v2`) and
[`Google-Teachable-Machine-TFLite-model-training`](../Google-Teachable-Machine-TFLite-model-training)
with its Python `.venv` built (Python 3.11). `arduino-cli` on PATH.

```bash
cp dev.config.example.json dev.config.json   # adjust paths if needed
npm install
npm run dev
```

## Scripts

- `npm run dev` — run the app with HMR
- `npm run typecheck` — TS check
- `npm run dist:mac` / `dist:win` — package (needs sidecar resources, see below)

## Packaging

The installers bundle three sidecars: the pruned mixly tree, the PyInstaller
training backend, and arduino-cli plus a pre-seeded ESP32 toolchain (offline
compilation). Assemble them first, then package:

```bash
scripts/prepare-sidecars.sh      # mixly tree + PyInstaller onedir → resources/
scripts/fetch-arduino-cli.sh     # pinned CLI binaries → resources/arduino-cli/
scripts/build-arduino-bundle.sh  # ESP32 toolchain seed → resources/Arduino15-seed/
npm run dist:mac                 # → dist/AIoScout-<ver>-mac-<arch>.dmg
```

### CI (recommended)

`.github/workflows/build.yml` builds all three targets — mac-arm64
(`macos-latest`), mac-x64 (`macos-15-intel`), win-x64 (`windows-latest`) —
with caching for the toolchain downloads. Artifacts land on the run page;
pushing a `v*` tag also attaches them to a GitHub Release.

One-time setup:

1. Push the sibling repos at the refs named in the workflow's `env` block
   (`MIXLY_REF`, `AITRAINING_REF`) and update those refs when they merge.
2. If any of the three repos are private, create a fine-grained PAT with
   "Contents: Read" over them and add it as the `REPO_ACCESS_TOKEN` secret.
   Public repos need no token.
3. Run the workflow manually (Actions → build → Run workflow) or
   `git tag v0.1.0 && git push --tags`.

### Distribution notes (unsigned builds)

- **macOS**: first launch requires right-click → Open (once per machine), or
  whitelist via school MDM. Requirements: macOS 13+, ~8 GB disk, 8 GB RAM
  recommended (4 GB minimum). Apple Silicon and Intel each have their own dmg.
- **Windows**: SmartScreen → "More info" → "Run anyway". Requirements:
  Windows 10 1809+ / 11, 64-bit. No USB-serial drivers needed — the car's
  ESP32-S3 uses native USB CDC (in-box `usbser` driver).
- First app start copies the bundled ~2 GB toolchain into the user data dir
  (once); everything works offline afterwards.

## System requirements

| | macOS | Windows |
|---|---|---|
| OS | macOS 13 Ventura+ | Windows 10 1809+ / 11 (64-bit) |
| Arch | Apple Silicon (arm64 dmg) or Intel (x64 dmg) | x64 |
| RAM | 8 GB recommended, 4 GB minimum | same |
| Disk | ~8 GB free | ~8 GB free |
