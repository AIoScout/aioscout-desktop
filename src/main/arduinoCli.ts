// Bundled Arduino toolchain: on first launch (packaged builds) copy the
// pre-seeded Arduino15 directory from resources to userData so arduino-cli
// can compile for the ESP32 without any network access.

import fs from 'node:fs';
import path from 'node:path';
import { AppPaths } from './paths';

export class ArduinoToolchain {
  constructor(private readonly paths: AppPaths) {}

  get dataDir(): string {
    return path.join(this.paths.dataDir, 'Arduino15');
  }

  private get seedDir(): string | null {
    if (this.paths.isDev) return null;
    const arch = process.arch === 'x64' ? 'x64' : process.arch;
    const seed = path.join(process.resourcesPath, 'Arduino15-seed', process.platform, arch, 'Arduino15');
    return fs.existsSync(seed) ? seed : null;
  }

  /**
   * Ensure a usable ARDUINO_DIRECTORIES_DATA directory exists. Returns the
   * path (or null in dev, where the user's own arduino-cli install is used).
   */
  async ensure(): Promise<string | null> {
    if (this.paths.isDev) return null;

    const seed = this.seedDir;
    if (!seed) {
      console.warn('[arduino] no bundled seed found — arduino-cli will use its default data dir');
      return null;
    }
    if (fs.existsSync(this.dataDir)) return this.dataDir;

    console.log('[arduino] first run — copying bundled toolchain (this can take a minute)');
    const tmp = `${this.dataDir}.seeding`;
    fs.rmSync(tmp, { recursive: true, force: true });
    const t0 = Date.now();
    await copyDir(seed, tmp);
    // Marker so a crashed copy is redone rather than half-used.
    fs.writeFileSync(path.join(tmp, '.aioscout-seeded'), String(Date.now()));
    fs.renameSync(tmp, this.dataDir);
    console.log(`[arduino] seed ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return this.dataDir;
  }
}

function copyDir(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.cp(src, dest, { recursive: true }, (err) => (err ? reject(err) : resolve()));
  });
}
