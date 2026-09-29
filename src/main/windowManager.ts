// Window + subpage management. One BrowserWindow hosts the shell renderer;
// each subpage (block coding / AI training) is a sandboxed WebContentsView
// with NO nodeIntegration and NO preload — the mixly frontend must believe it
// runs in a plain browser (its env switch checks window.process) and talk to
// the embedded server over http/ws like in web mode.

import { BrowserWindow, WebContentsView, nativeTheme, shell } from 'electron';
import path from 'node:path';
import { AppSettings, PageId, Rect } from '../shared/types';

const HIDE_MIXLY_HOME_CSS = '[m-id="home-btn"]{display:none!important}';

export class WindowManager {
  readonly main: BrowserWindow;
  private coding: WebContentsView | null = null;
  private training: WebContentsView | null = null;
  private active: PageId | null = null;
  private bounds: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    this.main = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1200,
      minHeight: 760,
      title: 'AIoScout',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#101214' : '#f9f9f8',
      webPreferences: {
        // Shell renderer: isolated + sandboxed, talks to main via preload only.
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    this.main.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  get activePage(): PageId | null {
    return this.active;
  }

  get codingUrl(): string | null {
    return this.coding ? this.coding.webContents.getURL() : null;
  }

  /** Attach (lazily creating + loading) the view for a page. */
  show(page: PageId, url: string | null, settings: AppSettings): void {
    if (!url) return;
    const existing = page === 'coding' ? this.coding : this.training;
    const view = existing ?? this.createView(page);
    if (page === 'coding') this.coding = view;
    else this.training = view;

    this.detachInactive(page);
    if (!this.main.contentView.children.includes(view)) {
      this.main.contentView.addChildView(view);
    }
    this.applyBounds(view);
    this.active = page;

    // First-time load sequence. For the coding view we land on the server root
    // first so we can pre-seed localStorage (language) on the right origin,
    // then navigate to the board editor URL.
    if (view.webContents.getURL() === '') {
      const rootUrl = new URL(url).origin + '/';
      const target = url;
      view.webContents
        .loadURL(rootUrl)
        .then(() => {
          const seed = JSON.stringify({
            user: {
              language: settings.language,
              languageAuto: false,
              theme: 'auto' // follow the system theme, like the shell
            }
          });
          return view.webContents.executeJavaScript(
            `try { localStorage.setItem('mixly2.0', ${JSON.stringify(seed)}); } catch (e) {}`
          );
        })
        .then(() => view.webContents.loadURL(target))
        .catch((e) => console.error(`[views] ${page} initial load failed:`, e));
    }
  }

  private createView(page: PageId): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        // Deliberately bare: no preload, no node. window.process stays
        // undefined so mixly's frontend keeps its web/web-socket behavior.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    if (page === 'coding') {
      const insert = () =>
        view.webContents.insertCSS(HIDE_MIXLY_HOME_CSS).catch(() => {});
      view.webContents.on('did-finish-load', insert);
    }
    return view;
  }

  private detachInactive(page: PageId): void {
    const other = page === 'coding' ? this.training : this.coding;
    if (other) this.main.contentView.removeChildView(other);
  }

  /** Renderer reports the content-area rect (DIP) it reserved for subpages. */
  setContentBounds(rect: Rect): void {
    this.bounds = rect;
    const active = this.active === 'coding' ? this.coding : this.training;
    if (active) this.applyBounds(active);
  }

  private applyBounds(view: WebContentsView): void {
    const { x, y, width, height } = this.bounds;
    if (width <= 0 || height <= 0) return;
    view.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    });
  }

  /** Reload the coding view (e.g. after its backend restarted). */
  reloadCoding(boardUrl: string): void {
    const view = this.coding;
    if (!view) return;
    view.webContents.loadURL(boardUrl).catch((e) =>
      console.error('[views] coding reload failed:', e)
    );
  }

  destroyAll(): void {
    for (const v of [this.coding, this.training]) {
      if (v) this.main.contentView.removeChildView(v);
    }
    this.coding = null;
    this.training = null;
    this.active = null;
  }
}
