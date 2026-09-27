// AIoScout desktop app — main process entry.
//
// Startup order: window first (the shell paints instantly and doubles as the
// splash screen), then the block-coding backend (ready in ~1–2 s), then the
// training backend (eager by default; its 30–80 s TensorFlow boot hides behind
// the shell's progress panel).

import { app, Menu } from 'electron';
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

let paths: AppPaths | null = null;
let windows: WindowManager | null = null;
let settings: AppSettings | null = null;
let mixly: MixlyService | null = null;
let training: TrainingService | null = null;
let models: ModelLibrary | null = null;
let exportWatcher: ExportWatcher | null = null;
let quitting = false;

function buildMenu(): void {
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
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

let desiredPage: PageId = 'training';

function showPage(page: PageId): void {
  if (!windows || !mixly || !training || !settings) return;
  desiredPage = page;
  if (page === 'coding') {
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
