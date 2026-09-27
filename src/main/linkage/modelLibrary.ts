// Persistent named model library: userData/models/<id>/{model.tflite, labels.txt, meta.json}.
// The block-coding server reads this directory directly (AIOSCOUT_MODEL_LIBRARY)
// and lists it via GET /models, so entries survive restarts by construction.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ModelMeta } from '../../shared/types';

function readMetaLineLabels(dir: string): string[] {
  try {
    return fs
      .readFileSync(path.join(dir, 'labels.txt'), 'utf8')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export class ModelLibrary extends EventEmitter {
  constructor(private readonly root: string) {
    super();
    fs.mkdirSync(root, { recursive: true });
  }

  list(): ModelMeta[] {
    const out: ModelMeta[] = [];
    for (const name of fs.readdirSync(this.root)) {
      const meta = this.readOne(name);
      if (meta) out.push(meta);
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  }

  private readOne(id: string): ModelMeta | null {
    const dir = path.join(this.root, id);
    const tflite = path.join(dir, 'model.tflite');
    if (!/^[A-Za-z0-9._-]+$/.test(id) || !fs.existsSync(tflite)) return null;
    let meta: Partial<ModelMeta> = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    } catch {
      /* missing/corrupt meta — derive below */
    }
    const labels = Array.isArray(meta.labels) && meta.labels.length
      ? meta.labels
      : readMetaLineLabels(dir);
    return {
      id,
      name: typeof meta.name === 'string' && meta.name ? meta.name : id,
      createdAt: Number(meta.createdAt) || fs.statSync(tflite).birthtimeMs || 0,
      labels,
      sizeBytes: fs.statSync(tflite).size,
      source: meta.source === 'file' ? 'file' : 'training'
    };
  }

  private uniqueNameDir(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'model';
    let dir = path.join(this.root, slug);
    let n = 2;
    while (fs.existsSync(dir)) {
      dir = path.join(this.root, `${slug}-${n}`);
      n += 1;
    }
    return dir;
  }

  /** Import a model.tflite (+ optional labels.txt) into the library. */
  import(
    tflitePath: string,
    labelsPath: string | null,
    name: string,
    source: 'training' | 'file'
  ): ModelMeta {
    const id = crypto.randomBytes(5).toString('hex');
    const dir = this.uniqueNameDir(name || id);
    const finalId = path.basename(dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(tflitePath, path.join(dir, 'model.tflite'));
    const labels = labelsPath && fs.existsSync(labelsPath)
      ? fs.copyFileSync(labelsPath, path.join(dir, 'labels.txt')) || readMetaLineLabels(dir)
      : [];
    const meta: ModelMeta = {
      id: finalId,
      name: name || finalId,
      createdAt: Date.now(),
      labels,
      sizeBytes: fs.statSync(path.join(dir, 'model.tflite')).size,
      source
    };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    this.emit('changed', { event: 'added', model: meta } as const);
    return meta;
  }

  rename(id: string, name: string): ModelMeta | null {
    const current = this.readOne(id);
    if (!current) return null;
    const meta = { ...current, name: name.trim() || current.name };
    fs.writeFileSync(
      path.join(this.root, id, 'meta.json'),
      JSON.stringify(meta, null, 2)
    );
    this.emit('changed', { event: 'renamed', model: meta } as const);
    return meta;
  }

  delete(id: string): boolean {
    const dir = path.join(this.root, id);
    if (!/^[A-Za-z0-9._-]+$/.test(id) || !fs.existsSync(path.join(dir, 'model.tflite'))) {
      return false;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    this.emit('changed', { event: 'removed', model: { id } as ModelMeta } as const);
    return true;
  }
}
