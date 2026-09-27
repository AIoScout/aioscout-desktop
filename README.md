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
- `npm run dist:mac` / `dist:win` — package (needs sidecar resources, see `scripts/` in Phase 7)
