// Watches the training app's blockcoding_outbox directory. The training
// backend writes model.tflite + labels.txt into a fresh sub-directory per
// export; once a sub-directory is complete (both files present, stable), the
// watcher imports it into the persistent model library and removes the outbox
// entry.

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const SETTLE_MS = 600;

interface PendingCheck {
  dir: string;
  timer: NodeJS.Timeout;
}

export class ExportWatcher extends EventEmitter {
  private watcher: fs.FSWatcher | null = null;
  private pending = new Map<string, PendingCheck>();
  private stopped = false;

  constructor(
    private readonly outboxDir: string,
    private readonly onExport: (dir: string) => void
  ) {
    super();
    fs.mkdirSync(outboxDir, { recursive: true });
  }

  start(): void {
    this.stopped = false;
    // Pick up anything written while we weren't watching.
    this.scan();
    try {
      this.watcher = fs.watch(this.outboxDir, () => this.scan());
    } catch (e) {
      console.error('[linkage] cannot watch outbox:', e instanceof Error ? e.message : e);
    }
  }

  private scan(): void {
    if (this.stopped) return;
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(this.outboxDir);
    } catch {
      return;
    }
    for (const name of entries) {
      const dir = path.join(this.outboxDir, name);
      if (this.pending.has(dir)) continue;
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      // Files may still be copying — check completeness after a settle delay,
      // then again on the next event if still incomplete.
      const timer = setTimeout(() => this.check(dir), SETTLE_MS);
      this.pending.set(dir, { dir, timer });
    }
  }

  private check(dir: string): void {
    const pending = this.pending.get(dir);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(dir);
    if (this.stopped) return;

    const tflite = path.join(dir, 'model.tflite');
    if (!fs.existsSync(tflite)) {
      // labels.txt may arrive after model.tflite — re-arm briefly, then give up.
      try {
        if (fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir); // empty leftover
          return;
        }
      } catch {
        return;
      }
      const timer = setTimeout(() => this.check(dir), 2 * SETTLE_MS);
      this.pending.set(dir, { dir, timer });
      return;
    }

    const size = fs.statSync(tflite).size;
    if (size === 0) {
      const timer = setTimeout(() => this.check(dir), SETTLE_MS);
      this.pending.set(dir, { dir, timer });
      return;
    }

    try {
      this.onExport(dir);
      fs.rmSync(dir, { recursive: true, force: true });
      this.emit('imported', dir);
    } catch (e) {
      console.error('[linkage] import failed for', dir, e instanceof Error ? e.message : e);
      // Leave the directory for a later retry/manual inspection.
    }
  }

  stop(): void {
    this.stopped = true;
    this.watcher?.close();
    this.watcher = null;
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
  }
}
