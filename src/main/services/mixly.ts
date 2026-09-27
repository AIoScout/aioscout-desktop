// Mixly block-coding service: forks the (refactored, embeddable) server.js
// from the mixly_lite tree. In packaged builds the Electron binary doubles as
// Node via ELECTRON_RUN_AS_NODE, so no separate Node runtime is shipped.

import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { BaseService } from './base';
import { AppPaths } from '../paths';
import { httpOk } from './util';

const HEALTH_POLL_MS = 10_000;

export class MixlyService extends BaseService {
  private child: ChildProcess | null = null;
  private healthTimer: NodeJS.Timeout | null = null;

  constructor(private readonly paths: AppPaths) {
    super('mixly');
  }

  protected urlFor(port: number): string {
    return `http://127.0.0.1:${port}`;
  }

  protected doStart(): void {
    const serverJs = path.join(this.paths.mixlyDir, 'server.js');
    this.child = fork(serverJs, [], {
      env: {
        ...process.env,
        // Run the Electron binary as plain Node for this child.
        ELECTRON_RUN_AS_NODE: '1',
        AIOSCOUT_PORT: '0',
        AIOSCOUT_HOST: '127.0.0.1',
        AIOSCOUT_RESOURCE_DIR: this.paths.mixlyDir,
        AIOSCOUT_DATA_DIR: this.paths.mixlyDataDir,
        ARDUINO_CLI: this.paths.arduinoCli ?? 'arduino-cli',
        P4_IMX219_LIB: path.join(this.paths.mixlyDir, 'ESP32-P4-IMX219-PoC')
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      cwd: this.paths.mixlyDir
    });

    this.child.on('message', (msg: unknown) => {
      const m = msg as { type?: string; port?: number };
      if (m && m.type === 'aioscout:ready' && typeof m.port === 'number') {
        this.onListening(m.port);
      }
    });

    const forward = (buf: Buffer) => {
      const text = buf.toString().trim();
      if (text) console.log(`[mixly] ${text}`);
    };
    this.child.stdout?.on('data', forward);
    this.child.stderr?.on('data', forward);
    this.child.on('error', (e) => this.fail(e));
    this.child.on('exit', () => {
      this.stopHealthPoll();
      this.child = null;
      this.died();
    });
  }

  private onListening(port: number): void {
    if (this.status.state === 'ready') return;
    this.ready(port);
    this.startHealthPoll(port);
  }

  private startHealthPoll(port: number): void {
    this.stopHealthPoll();
    this.healthTimer = setInterval(async () => {
      // The child-exit handler covers hard crashes; this catches a wedged
      // server process. Just log for now — restarting on a single failed poll
      // risks killing slow compiles (a busy event loop can miss one poll).
      if (!(await httpOk(`http://127.0.0.1:${port}/healthz`, 3000))) {
        console.warn('[mixly] health poll failed');
      }
    }, HEALTH_POLL_MS);
    this.healthTimer.unref();
  }

  private stopHealthPoll(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  protected async killChild(): Promise<void> {
    this.stopHealthPoll();
    const child = this.child;
    this.child = null;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 3000);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
      // server.js handles SIGTERM by killing arduino-cli + closing serial ports.
      child.kill('SIGTERM');
    });
  }
}
