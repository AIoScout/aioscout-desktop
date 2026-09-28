// Bundled Arduino toolchain: on first launch (packaged builds) copy the
// pre-seeded Arduino15 directory from resources to userData so arduino-cli
// can compile for the ESP32 without any network access.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppPaths } from './paths';

const execFileAsync = promisify(execFile);

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
   * The bundled toolchain's ctags binary is x86_64-only (upstream Arduino
   * ships no arm64 build), so Apple Silicon needs Rosetta 2 to compile.
   * Install it if missing (Apple's official installer; runs without sudo,
   * needs network — most Macs already have it).
   */
  private async ensureRosetta(): Promise<void> {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') return;
    try {
      await execFileAsync('arch', ['-x86_64', '/usr/bin/true']);
      return; // Rosetta present
    } catch {
      console.log('[arduino] Rosetta 2 missing — installing (about a minute)');
    }
    try {
      await execFileAsync('softwareupdate', [
        '--install-rosetta',
        '--agree-to-license'
      ]);
      console.log('[arduino] Rosetta 2 installed');
    } catch (e) {
      console.error(
        '[arduino] Rosetta 2 install failed (compiles will not work on this Mac):',
        e instanceof Error ? e.message : e
      );
    }
  }

  /**
   * Ensure a usable ARDUINO_DIRECTORIES_DATA directory exists. Returns the
   * path (or null in dev, where the user's own arduino-cli install is used).
   */
  async ensure(): Promise<string | null> {
    await this.ensureRosetta();

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
