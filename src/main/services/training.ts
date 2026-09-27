// AI training backend service: spawns the Python launcher in --headless mode
// and waits for its single stdout JSON line {"type":"aioscout:ready",...},
// then polls HTTP until the Streamlit server actually answers. Cold start is
// ~30–80 s while TensorFlow imports, so the service reports progress phases
// for the shell's loading panel.

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BaseService } from './base';
import { AppPaths } from '../paths';
import { httpOk, sleep, tryParseJsonLine } from './util';
import { TrainingPhase } from '../../shared/types';

export class TrainingService extends BaseService {
  private child: ChildProcess | null = null;
  private pollAbort = false;
  private phaseTimer: NodeJS.Timeout | null = null;
  private logStream: fs.WriteStream | null = null;

  constructor(private readonly paths: AppPaths) {
    super('training');
  }

  protected urlFor(port: number): string {
    return `http://127.0.0.1:${port}`;
  }

  protected doStart(): void {
    this.pollAbort = false;
    const { cmd, args } = this.paths.trainingCommand;

    const logFile = path.join(this.paths.logsDir, 'training.log');
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    this.logStream.write(`\n===== ${new Date().toISOString()} spawn: ${cmd} ${args.join(' ')} =====\n`);

    this.child = spawn(cmd, args, {
      env: {
        ...process.env,
        TFLITE_TRAINING_DATA_DIR: this.paths.trainingDataDir
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    this.progress('spawning', cmd);

    let buffer = '';
    this.child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString();
      this.logStream?.write(text);
      buffer += text;
      // The launcher prints exactly one JSON line on stdout; everything else
      // is noise. Scan complete lines for it.
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const parsed = tryParseJsonLine(line);
        if (parsed && parsed['type'] === 'aioscout:ready' && typeof parsed['port'] === 'number') {
          this.onPortKnown(parsed['port'] as number);
        }
      }
    });
    this.child.stderr?.on('data', (buf: Buffer) => this.logStream?.write(buf.toString()));
    this.child.on('error', (e) => this.fail(e));
    this.child.on('exit', () => {
      this.child = null;
      this.stopPhaseTimer();
      this.died();
    });

    // Honest time-based copy while the Python/TF world boots: after 3 s with
    // no port line we are almost certainly deep in TF imports.
    this.phaseTimer = setTimeout(() => {
      if (this.status.state === 'starting') this.progress('loading-libraries', null);
    }, 3000);
  }

  private async onPortKnown(port: number): Promise<void> {
    if (this.status.state === 'ready' || this.pollAbort) return;
    this.progress('almost-ready', null);
    const url = `http://127.0.0.1:${port}`;
    // The launcher already waits for HTTP readiness before printing the line,
    // but re-verify in case of a race; keep polling while the child lives.
    for (let i = 0; i < 20; i++) {
      if (this.pollAbort || !this.child) return;
      if (await httpOk(url, 3000)) {
        this.progress('ready', null);
        this.ready(port);
        return;
      }
      await sleep(1000);
    }
    this.fail(new Error(`training server at ${url} never answered`));
  }

  private progress(phase: TrainingPhase, detail: string | null): void {
    this.emit('progress', { phase, detail } as const);
  }

  private stopPhaseTimer(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
  }

  protected async killChild(): Promise<void> {
    this.pollAbort = true;
    this.stopPhaseTimer();
    const child = this.child;
    this.child = null;
    this.logStream?.end();
    this.logStream = null;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
      // SIGTERM makes the launcher reap the streamlit child; its own ppid
      // watchdog covers the SIGKILL case.
      child.kill('SIGTERM');
    });
  }
}
