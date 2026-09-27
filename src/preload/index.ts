import { contextBridge, ipcRenderer } from 'electron';
import { IPC, AppSettings, PageId, Rect, ServiceId, ServiceStatus, TrainingProgress, ModelMeta, ModelChangeEvent } from '../shared/types';

const api = {
  services: {
    getStatus(): Promise<{ mixly: ServiceStatus; training: ServiceStatus }> {
      return ipcRenderer.invoke(IPC.ServicesGetStatus);
    },
    restart(id: ServiceId): Promise<ServiceStatus> {
      return ipcRenderer.invoke(IPC.ServicesRestart, id);
    }
  },
  nav: {
    show(page: PageId): Promise<boolean> {
      return ipcRenderer.invoke(IPC.NavShow, page);
    },
    setContentBounds(rect: Rect): Promise<boolean> {
      return ipcRenderer.invoke(IPC.NavSetContentBounds, rect);
    }
  },
  settings: {
    get(): Promise<AppSettings> {
      return ipcRenderer.invoke(IPC.SettingsGet);
    },
    set(patch: Partial<AppSettings>): Promise<AppSettings> {
      return ipcRenderer.invoke(IPC.SettingsSet, patch);
    }
  },
  app: {
    openLogs(): Promise<boolean> {
      return ipcRenderer.invoke(IPC.AppOpenLogs);
    },
    quit(): Promise<boolean> {
      return ipcRenderer.invoke(IPC.AppQuit);
    }
  },
  models: {
    list(): Promise<ModelMeta[]> {
      return ipcRenderer.invoke(IPC.ModelsList);
    },
    rename(id: string, name: string): Promise<ModelMeta | null> {
      return ipcRenderer.invoke(IPC.ModelsRename, id, name);
    },
    remove(id: string): Promise<boolean> {
      return ipcRenderer.invoke(IPC.ModelsDelete, id);
    },
    importFile(): Promise<ModelMeta | null> {
      return ipcRenderer.invoke(IPC.ModelsImportFile);
    }
  },
  on: {
    servicesStatusChanged(cb: (status: ServiceStatus) => void): () => void {
      const listener = (_e: unknown, v: ServiceStatus) => cb(v);
      ipcRenderer.on(IPC.ServicesStatusChanged, listener);
      return () => ipcRenderer.removeListener(IPC.ServicesStatusChanged, listener);
    },
    trainingProgress(cb: (p: TrainingProgress) => void): () => void {
      const listener = (_e: unknown, v: TrainingProgress) => cb(v);
      ipcRenderer.on(IPC.TrainingProgress, listener);
      return () => ipcRenderer.removeListener(IPC.TrainingProgress, listener);
    },
    modelsChanged(cb: (e: ModelChangeEvent) => void): () => void {
      const listener = (_e: unknown, v: ModelChangeEvent) => cb(v);
      ipcRenderer.on(IPC.ModelsChanged, listener);
      return () => ipcRenderer.removeListener(IPC.ModelsChanged, listener);
    }
  }
};

contextBridge.exposeInMainWorld('aioscout', api);

export type AioscoutApi = typeof api;
