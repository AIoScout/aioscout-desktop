// Shared contract between the Electron main process, the preload bridge and
// the shell renderer. Keep channel names and payload shapes in sync here.

export type ServiceId = 'mixly' | 'training';
export type ServiceState = 'stopped' | 'starting' | 'ready' | 'failed' | 'restarting';
export type PageId = 'training' | 'coding';

export interface ServiceStatus {
  id: ServiceId;
  state: ServiceState;
  port: number | null;
  url: string | null;
  detail: string | null;
  restarts: number;
}

export interface AppSettings {
  /** UI language, also pre-seeded into the block editor's localStorage. */
  language: 'en' | 'zh-hans' | 'zh-hant';
  /** Start the training backend eagerly on launch, or only when its tab is opened. */
  trainingStartMode: 'eager' | 'on-demand';
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  trainingStartMode: 'eager'
};

export type TrainingPhase =
  | 'spawning'
  | 'starting-python'
  | 'loading-libraries'
  | 'almost-ready'
  | 'ready'
  | 'failed';

export interface TrainingProgress {
  phase: TrainingPhase;
  detail: string | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModelMeta {
  id: string;
  name: string;
  createdAt: number;
  labels: string[];
  sizeBytes: number;
  source: 'training' | 'file';
}

export interface ModelChangeEvent {
  event: 'added' | 'renamed' | 'removed';
  model: ModelMeta;
}

export const IPC = {
  // renderer -> main (invoke)
  ServicesGetStatus: 'services:getStatus',
  ServicesRestart: 'services:restart',
  NavShow: 'nav:show',
  NavSetContentBounds: 'nav:setContentBounds',
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
  AppOpenLogs: 'app:openLogs',
  AppQuit: 'app:quit',
  ModelsList: 'models:list',
  ModelsRename: 'models:rename',
  ModelsDelete: 'models:delete',
  ModelsImportFile: 'models:importFile',
  // main -> renderer (send)
  ServicesStatusChanged: 'services:statusChanged',
  TrainingProgress: 'training:progress',
  ActivePageChanged: 'nav:activePageChanged',
  ModelsChanged: 'models:changed',
  ZoomChanged: 'zoom:changed'
} as const;
