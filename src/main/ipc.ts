// IPC surface between the shell renderer and the main process.

import { BrowserWindow, ipcMain, shell } from 'electron';
import { IPC, PageId, Rect, ServiceId, AppSettings } from '../shared/types';
import { AppPaths } from './paths';
import { MixlyService } from './services/mixly';
import { TrainingService } from './services/training';
import { loadSettings, saveSettings } from './settings';

interface IpcDeps {
  paths: AppPaths;
  mixly: MixlyService;
  training: TrainingService;
  getWindow: () => BrowserWindow | null;
  showPage: (page: PageId) => void;
  setContentBounds: (rect: Rect) => void;
}

export function registerIpc(deps: IpcDeps): void {
  const broadcast = (channel: string, payload: unknown) => {
    const win = deps.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  ipcMain.handle(IPC.ServicesGetStatus, () => ({
    mixly: deps.mixly.status,
    training: deps.training.status
  }));

  ipcMain.handle(IPC.ServicesRestart, (_e, id: ServiceId) => {
    const svc = id === 'mixly' ? deps.mixly : deps.training;
    void svc.restart();
    return svc.status;
  });

  ipcMain.handle(IPC.NavShow, (_e, page: PageId) => {
    deps.showPage(page);
    return true;
  });

  ipcMain.handle(IPC.NavSetContentBounds, (_e, rect: Rect) => {
    deps.setContentBounds(rect);
    return true;
  });

  ipcMain.handle(IPC.SettingsGet, () => loadSettings());

  ipcMain.handle(IPC.SettingsSet, (_e, patch: Partial<AppSettings>) => {
    const next = { ...loadSettings(), ...patch };
    return saveSettings(next);
  });

  ipcMain.handle(IPC.AppOpenLogs, () => {
    void shell.openPath(deps.paths.logsDir);
    return true;
  });

  ipcMain.handle(IPC.AppQuit, () => {
    const win = deps.getWindow();
    if (win) win.close();
    return true;
  });

  // Push service status/progress updates to the renderer.
  for (const svc of [deps.mixly, deps.training]) {
    svc.on('status', (status: unknown) => broadcast(IPC.ServicesStatusChanged, status));
  }
  deps.training.on('progress', (progress: unknown) =>
    broadcast(IPC.TrainingProgress, progress)
  );
}
