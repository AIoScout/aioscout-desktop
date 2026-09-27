import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types';

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf8'));
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(settings, null, 2));
  return settings;
}
