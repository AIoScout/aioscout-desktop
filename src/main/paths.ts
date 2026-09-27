// Single source of truth for resolving the sidecar components in dev and
// packaged builds. Everything downstream consumes paths from here only.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface DevConfig {
  mixlyDir: string;
  trainingDir: string;
  trainingPython: string;
  arduinoCli?: string;
}

export interface AppPaths {
  isDev: boolean;
  /** Root of the mixly_lite tree (read-only resources: frontend, SmartCar, Mixly_TFLite…). */
  mixlyDir: string;
  /** Root of the AItraining tree (dev) / PyInstaller bundle parent (packaged). */
  trainingDir: string;
  /** Headless training backend launch command. */
  trainingCommand: { cmd: string; args: string[] };
  /** arduino-cli path (null → let the mixly server fall back to PATH lookup). */
  arduinoCli: string | null;
  /** Per-app writable root (Electron userData). */
  dataDir: string;
  mixlyDataDir: string;
  trainingDataDir: string;
  logsDir: string;
  modelsDir: string;
  /** ARDUINO_DIRECTORIES_DATA for the mixly server (set after toolchain seeding). */
  arduinoDataDir: string | null;
}

function readDevConfig(): DevConfig {
  const repoRoot = path.dirname(app.getAppPath());
  const candidates = [
    path.join(repoRoot, 'dev.config.json'),
    path.join(__dirname, '..', '..', 'dev.config.json')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as DevConfig;
    }
  }
  throw new Error(
    `dev.config.json not found. Copy dev.config.example.json to dev.config.json next to this app ` +
      `and point it at your sibling checkouts (mixly_lite, AItraining).`
  );
}

function failMissing(p: string, what: string): string {
  throw new Error(`Cannot find ${what}: ${p}. Check dev.config.json (see dev.config.example.json).`);
}

export function resolvePaths(): AppPaths {
  const dataDir = app.getPath('userData');
  const paths: AppPaths = {
    isDev: !app.isPackaged,
    mixlyDir: '',
    trainingDir: '',
    trainingCommand: { cmd: '', args: [] },
    arduinoCli: null,
    dataDir,
    mixlyDataDir: path.join(dataDir, 'mixly-data'),
    trainingDataDir: path.join(dataDir, 'training-data'),
    logsDir: path.join(dataDir, 'logs'),
    modelsDir: path.join(dataDir, 'models'),
    arduinoDataDir: null
  };

  if (app.isPackaged) {
    const res = process.resourcesPath;
    paths.mixlyDir = path.join(res, 'mixly');
    paths.trainingDir = path.join(res, 'training');
    const bin = path.join(paths.trainingDir, process.platform === 'win32' ? 'TFLiteTraining.exe' : 'TFLiteTraining');
    paths.trainingCommand = { cmd: bin, args: ['--headless'] };
    const cliName = process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
    const cliRoot = path.join(res, 'arduino-cli', process.platform, process.arch);
    if (fs.existsSync(path.join(cliRoot, cliName))) {
      paths.arduinoCli = path.join(cliRoot, cliName);
    } else {
      paths.arduinoCli = cliName; // fall back to PATH
    }
  } else {
    const dev = readDevConfig();
    paths.mixlyDir = path.resolve(app.getAppPath(), dev.mixlyDir);
    if (!fs.existsSync(path.join(paths.mixlyDir, 'server.js'))) {
      failMissing(paths.mixlyDir, 'mixly_lite (server.js)');
    }
    paths.trainingDir = path.resolve(app.getAppPath(), dev.trainingDir);
    const launcher = path.join(paths.trainingDir, 'desktop_launcher.py');
    if (!fs.existsSync(launcher)) {
      failMissing(launcher, 'AItraining desktop_launcher.py');
    }
    const python = path.resolve(app.getAppPath(), dev.trainingPython);
    if (!fs.existsSync(python)) {
      failMissing(python, 'AItraining .venv python');
    }
    paths.trainingCommand = { cmd: python, args: [launcher, '--headless'] };
    paths.arduinoCli = dev.arduinoCli || 'arduino-cli';
  }

  for (const dir of [paths.mixlyDataDir, paths.trainingDataDir, paths.logsDir, paths.modelsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return paths;
}

/**
 * Board editor URL that skips Mixly's home view. Mirrors exactly what the home
 * page generates (board-manager.js + Url.jsonToUrl): values are
 * percent-ENCODED — raw slashes in the query corrupt Mixly's web path shim,
 * which derives Env.indexDirPath from location.href — and boardIndex is
 * relative to the site root (prefixed with boards/).
 */
export function boardEditorUrl(port: number): string {
  const params = [
    ['thirdPartyBoard', 'false'],
    ['boardIndex', 'boards/default/arduino_esp32/index.xml'],
    ['boardType', 'Arduino ESP32'],
    ['boardImg', './boards/default/arduino_esp32/media/esp32_compressed.png'],
    ['language', 'C/C++']
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `http://127.0.0.1:${port}/boards/index.html?${params}`;
}
