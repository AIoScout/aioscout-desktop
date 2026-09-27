// Base class for supervised child services: state machine, crash detection,
// capped exponential restart backoff (1s → 5s → 15s → manual restart).

import { EventEmitter } from 'node:events';
import { ServiceId, ServiceState, ServiceStatus } from '../../shared/types';

const BACKOFF_MS = [1000, 5000, 15000];

export abstract class BaseService extends EventEmitter {
  protected port: number | null = null;
  private state: ServiceState = 'stopped';
  private detail: string | null = null;
  private failures = 0;
  private timer: NodeJS.Timeout | null = null;
  private stoppedByUs = false;
  restarts = 0;

  protected constructor(public readonly id: ServiceId) {
    super();
  }

  get status(): ServiceStatus {
    return {
      id: this.id,
      state: this.state,
      port: this.port,
      url: this.port !== null ? this.urlFor(this.port) : null,
      detail: this.detail,
      restarts: this.restarts
    };
  }

  protected abstract urlFor(port: number): string;
  /** Spawn the child. Report readiness with ready(), unexpected death with died(), spawn errors with fail(). */
  protected abstract doStart(): void;
  protected abstract killChild(): Promise<void>;

  start(): void {
    this.failures = 0;
    this.launch();
  }

  private launch(): void {
    this.stoppedByUs = false;
    this.set('starting', null);
    try {
      this.doStart();
    } catch (e) {
      this.fail(e);
    }
  }

  protected ready(port: number): void {
    this.port = port;
    this.failures = 0;
    this.set('ready', null);
    this.emit('ready', port);
  }

  protected died(): void {
    if (this.stoppedByUs) {
      this.set('stopped', null);
    } else {
      this.fail(new Error('process exited unexpectedly'));
    }
  }

  protected fail(e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    if (this.failures < BACKOFF_MS.length) {
      const delay = BACKOFF_MS[this.failures];
      this.failures += 1;
      this.restarts += 1;
      this.set('restarting', `${msg} — restarting in ${Math.round(delay / 1000)}s`);
      this.timer = setTimeout(() => this.launch(), delay);
    } else {
      this.set('failed', `${msg} — give up (manual restart required)`);
    }
  }

  async restart(): Promise<void> {
    await this.close();
    this.start();
  }

  async close(): Promise<void> {
    this.stoppedByUs = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.killChild();
    this.port = null;
    this.set('stopped', null);
  }

  protected set(state: ServiceState, detail: string | null): void {
    this.state = state;
    this.detail = detail;
    this.emit('status', this.status);
  }
}
