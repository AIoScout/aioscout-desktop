// AIoScout desktop app — main process entry.
//
// Startup order: window first (the shell paints instantly and doubles as the
// splash screen), then the block-coding backend (ready in ~1–2 s), then the
// training backend (eager by default; its 30–80 s TensorFlow boot hides behind
// the shell's progress panel).

import { app, Menu, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AppSettings, IPC, PageId } from '../shared/types';
import { AppPaths, boardEditorUrl, resolvePaths } from './paths';
import { loadSettings } from './settings';
import { WindowManager } from './windowManager';
import { MixlyService } from './services/mixly';
import { TrainingService } from './services/training';
import { registerIpc } from './ipc';
import { ModelLibrary } from './linkage/modelLibrary';
import { ExportWatcher } from './linkage/exportWatcher';
import { ArduinoToolchain } from './arduinoCli';
import { httpRequest } from './services/util';

let paths: AppPaths | null = null;
let windows: WindowManager | null = null;
let settings: AppSettings | null = null;
let mixly: MixlyService | null = null;
let training: TrainingService | null = null;
let models: ModelLibrary | null = null;
let exportWatcher: ExportWatcher | null = null;
let quitting = false;

function buildMenu(): void {
  const zoomStep = (delta: number) => {
    if (!windows) return;
    const current = windows.main.webContents.getZoomFactor();
    const next = delta === 0 ? 1 : Math.min(3, Math.max(0.5, current + delta));
    windows.setZoomFactorAll(next);
  };
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        // Custom zoom: the role-based items only zoom the focused
        // webContents; we scale the shell AND both subpage views together.
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+=',
          click: () => zoomStep(0.1)
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => zoomStep(-0.1)
        },
        {
          label: 'Actual Size',
          accelerator: 'CommandOrControl+0',
          click: () => zoomStep(0)
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

let desiredPage: PageId = 'home';

/** Release the serial ports held by the page the user is leaving, so the
 * other app can open the same board. mixly: serial monitor ports via
 * /serial/close-all; training: live device sessions via the RecordController
 * API, whose port the training backend publishes to
 * <training-data>/record_controller_port.json. */
function releaseSerialFor(page: PageId): void {
  if (!mixly || !training || !paths) return;
  if (page === 'coding') {
    const port = mixly.status.port;
    if (port === null) return;
    void httpRequest('POST', `http://127.0.0.1:${port}/serial/close-all`)
      .then(() => console.log('[serial] released (coding left)'))
      .catch((e) => console.warn('[serial] release failed for coding:', e instanceof Error ? e.message : e));
  } else {
    const rcPort = readRecordControllerPort();
    if (rcPort === null) return;
    void httpRequest('GET', `http://127.0.0.1:${rcPort}/live/close-all`)
      .then(() => console.log('[serial] released (training left)'))
      .catch((e) => console.warn('[serial] release failed for training:', e instanceof Error ? e.message : e));
  }
}

function readRecordControllerPort(): number | null {
  try {
    const raw = fs.readFileSync(
      path.join(paths!.trainingDataDir, 'record_controller_port.json'),
      'utf8'
    );
    const port = JSON.parse(raw)?.port;
    return typeof port === 'number' ? port : null;
  } catch {
    return null; // not started / no page rendered yet — nothing to release
  }
}

function showPage(page: PageId): void {
  if (!windows || !mixly || !training || !settings) return;
  const previous = desiredPage;
  desiredPage = page;
  if (previous && previous !== page) releaseSerialFor(previous);
  if (page === 'home') {
    // Index page: no subpage view — just the shell renderer.
    windows.detachAll();
  } else if (page === 'coding') {
    if (mixly.status.state === 'ready' && mixly.status.port) {
      windows.show('coding', boardEditorUrl(mixly.status.port), settings);
    }
  } else {
    // Clicking the training tab also starts the backend in on-demand mode.
    if (training.status.state === 'stopped' || training.status.state === 'failed') {
      training.start();
    }
    if (training.status.state === 'ready' && training.status.port) {
      windows.show('training', `http://127.0.0.1:${training.status.port}`, settings);
    }
  }
  const win = windows.main;
  if (win && !win.isDestroyed()) win.webContents.send(IPC.ActivePageChanged, page);
}

function boot(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (windows) {
      if (windows.main.isMinimized()) windows.main.restore();
      windows.main.focus();
    }
  });

  try {
    paths = resolvePaths();
  } catch (e) {
    // Path problems are a dev-setup issue — surface them loudly.
    console.error(e instanceof Error ? e.message : e);
    app.quit();
    return;
  }
  settings = loadSettings();
  buildMenu();

  // Dev runs show the Electron icon in the dock — use the app icon instead
  // (packaged builds pick it up from the bundle automatically).
  if (process.platform === 'darwin' && !app.isPackaged) {
    try {
      app.dock?.setIcon(
        nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'))
      );
    } catch {
      /* cosmetic only */
    }
  }

  windows = new WindowManager();
  windows.main.on('closed', () => {
    windows = null;
  });

  mixly = new MixlyService(paths);
  training = new TrainingService(paths);

  // Model linkage: watch the training app's outbox, import into the library.
  models = new ModelLibrary(paths.modelsDir);
  const outboxDir = path.join(paths.trainingDataDir, 'blockcoding_outbox');
  exportWatcher = new ExportWatcher(outboxDir, (dir) => {
    const name = `Model ${new Date().toLocaleString()}`;
    models!.import(
      path.join(dir, 'model.tflite'),
      path.join(dir, 'labels.txt'),
      name,
      'training'
    );
  });
  exportWatcher.start();

  registerIpc({
    paths,
    mixly,
    training,
    models,
    getWindow: () => windows?.main ?? null,
    showPage,
    setContentBounds: (rect) => windows?.setContentBounds(rect)
  });

  // The renderer loads the shell immediately (it is also the splash screen).
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    windows.main.loadURL(devServerUrl);
  } else {
    windows.main.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // After a mixly restart the frontend's WebSocket clients are unreliable —
  // reload the coding view when it comes back.
  mixly.on('ready', (port: number) => {
    if (quitting || !windows) return;
    if (desiredPage === 'coding') {
      windows.show('coding', boardEditorUrl(port), settings!);
    } else if (windows.codingUrl) {
      windows.reloadCoding(boardEditorUrl(port));
    }
  });

  // If the user is sitting on the training tab while its backend boots,
  // attach the view the moment it becomes ready.
  training.on('ready', (port: number) => {
    if (quitting || !windows) return;
    if (desiredPage === 'training') {
      windows.show('training', `http://127.0.0.1:${port}`, settings!);
    }
  });

  app.on('before-quit', async (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    windows?.destroyAll();
    exportWatcher?.stop();
    await Promise.allSettled([mixly?.close(), training?.close()]);
    app.exit(0);
  });

  void startServices();
}

async function startServices(): Promise<void> {
  if (!paths || !mixly || !training) return;
  // Bundled Arduino toolchain (packaged builds): seed userData/Arduino15 on
  // first run, then point the mixly server's arduino-cli at it. Dev builds
  // use the user's own arduino-cli + default data dir.
  const toolchain = new ArduinoToolchain(paths);
  paths.arduinoDataDir = await toolchain.ensure();

  mixly.start();
  if (settings?.trainingStartMode === 'eager') {
    training.start();
  }
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  app.quit();
});
