// Shell renderer: navigation, service status, training progress panel,
// and reporting the subpage content bounds to the main process.

const els = {
  nav: document.getElementById('nav'),
  navLinks: {
    home: document.getElementById('nav-home'),
    training: document.getElementById('nav-training'),
    coding: document.getElementById('nav-coding')
  },
  chips: {
    training: document.getElementById('chip-training'),
    mixly: document.getElementById('chip-mixly')
  },
  host: document.getElementById('subpage-host'),
  panels: {
    home: document.getElementById('panel-home'),
    training: document.getElementById('panel-training'),
    coding: document.getElementById('panel-coding')
  },
  trainingCopy: document.getElementById('training-phase-copy'),
  trainingActions: document.getElementById('training-actions'),
  codingCopy: document.getElementById('coding-phase-copy')
};

const PHASE_COPY = {
  spawning: 'Starting the Python training engine…',
  'starting-python': 'Starting the Python training engine…',
  'loading-libraries':
    'Loading TensorFlow and the training libraries. The first start takes about a minute.',
  'almost-ready': 'Almost ready…',
  ready: 'Ready.',
  failed: 'The training engine failed to start.'
};

const STATE_LABEL = {
  stopped: 'Off',
  starting: 'Starting…',
  ready: 'Ready',
  restarting: 'Restarting…',
  failed: 'Failed'
};

let activePage = 'home';
const serviceStates = { training: 'stopped', mixly: 'stopped' };
let trainingPhase = null;

function renderNav() {
  for (const [page, link] of Object.entries(els.navLinks)) {
    link.classList.toggle('active', page === activePage);
  }
}

function renderStatusChip(id) {
  const chip = els.chips[id];
  const state = serviceStates[id];
  chip.dataset.state = state;
  chip.querySelector('.status-text').textContent = STATE_LABEL[state] ?? state;
}

function renderPanels() {
  const showHome = activePage === 'home';
  const showTraining =
    activePage === 'training' && (serviceStates.training !== 'ready' || trainingPhase === 'failed');
  const showCoding = activePage === 'coding' && serviceStates.mixly !== 'ready';
  els.panels.home.hidden = !showHome;
  els.panels.training.hidden = !showTraining;
  els.panels.coding.hidden = !showCoding;
}

function renderAll() {
  renderNav();
  renderStatusChip('training');
  renderStatusChip('mixly');
  renderPanels();
}

function switchPage(page) {
  activePage = page;
  renderAll();
  window.aioscout.nav.show(page);
}

for (const link of Object.values(els.navLinks)) {
  link.addEventListener('click', () => switchPage(link.dataset.page));
}
document.getElementById('card-training').addEventListener('click', () => switchPage('training'));
document.getElementById('card-coding').addEventListener('click', () => switchPage('coding'));

document.getElementById('btn-retry-training').addEventListener('click', () => {
  window.aioscout.services.restart('training');
  trainingPhase = null;
  renderAll();
});

document.getElementById('btn-open-logs').addEventListener('click', () => {
  window.aioscout.app.openLogs();
});

// ── Model toast ──────────────────────────────────────────────
const toastEl = document.getElementById('model-toast');
const toastName = document.getElementById('model-name-input');
let toastModelId = null;

document.getElementById('btn-model-save').addEventListener('click', async () => {
  if (toastModelId) {
    const name = toastName.value.trim();
    if (name) await window.aioscout.models.rename(toastModelId, name);
  }
  hideToast();
});

document.getElementById('btn-model-discard').addEventListener('click', async () => {
  if (toastModelId) await window.aioscout.models.remove(toastModelId);
  hideToast();
});

document.getElementById('btn-model-open-coding').addEventListener('click', async () => {
  const name = toastName.value.trim();
  if (toastModelId && name) await window.aioscout.models.rename(toastModelId, name);
  hideToast();
  switchPage('coding');
});

function hideToast() {
  toastModelId = null;
  toastEl.hidden = true;
}

window.aioscout.on.modelsChanged((e) => {
  if (e.event !== 'added') return;
  toastModelId = e.model.id;
  toastName.value = e.model.name;
  toastEl.hidden = false;
});

// ── Bounds reporting ─────────────────────────────────────────
// The subpage WebContentsView is positioned exactly over #subpage-host.
function reportBounds() {
  const r = els.host.getBoundingClientRect();
  window.aioscout.nav.setContentBounds({
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height
  });
}

const observer = new ResizeObserver(reportBounds);
observer.observe(els.host);
window.addEventListener('resize', reportBounds);
// The shell's CSS px change with app-wide zoom — re-report the rect so the
// main process keeps the subpage view exactly over the content area.
window.aioscout.on.zoomChanged(reportBounds);

// ── Events from main ─────────────────────────────────────────
window.aioscout.on.servicesStatusChanged((status) => {
  serviceStates[status.id] = status.state;
  renderAll();
  if (status.id === 'training' && status.state !== 'ready') {
    // Panel copy follows phases when available; fall back to state detail.
    if (status.detail) els.trainingCopy.textContent = status.detail;
  }
});

window.aioscout.on.trainingProgress((p) => {
  trainingPhase = p.phase;
  els.trainingCopy.textContent = PHASE_COPY[p.phase] ?? p.phase;
  els.trainingActions.hidden = p.phase !== 'failed';
  renderPanels();
});

// ── Boot ─────────────────────────────────────────────────────
(async () => {
  const status = await window.aioscout.services.getStatus();
  serviceStates.training = status.training.state;
  serviceStates.mixly = status.mixly.state;
  renderAll();
  reportBounds();
  // Default landing page is the index; tell main so it detaches subpage views.
  window.aioscout.nav.show('home');
})();


// ── Minimal markdown → HTML for license texts ────────────────────────
// The shell is sandboxed with no dependencies, so this covers the subset
// the EULA uses: headings, bold/italic, bullets and bare URLs. Input is
// escaped first; the output only contains markup generated here.
function renderMarkdown(md) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/(https?:\/\/[^\s)]+)/g, '<a href="#" data-ext="$1">$1</a>');
  const out = [];
  let list = null;
  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      if (list) { out.push('</' + list + '>'); list = null; }
      const level = Math.min(line.match(/^#+/)[0].length + 1, 4); // shift down one
      out.push(`<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (list !== 'ul') { if (list) out.push('</' + list + '>'); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (list !== 'ol') { if (list) out.push('</' + list + '>'); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      if (list) { out.push('</' + list + '>'); list = null; }
    } else {
      if (list) { out.push('</' + list + '>'); list = null; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (list) out.push('</' + list + '>');
  return out.join('\n');
}

// ── EULA gate + Licenses dialog ──────────────────────────────────────
// macOS DMGs have no install-time agreement surface, so the main app
// gates on first launch instead: the shell stays behind a modal until
// the product EULA is accepted (persisted by the main process). The AI
// Training sub-app shows its own, separate license screen on first use.

const licEls = {
  gate: document.getElementById('eula-gate'),
  gateText: document.getElementById('eula-text'),
  accept: document.getElementById('btn-eula-accept'),
  decline: document.getElementById('btn-eula-decline'),
  licensesLink: document.getElementById('eula-open-licenses'),
  navLicenses: document.getElementById('nav-licenses'),
  dialog: document.getElementById('licenses-dialog'),
  dialogClose: document.getElementById('btn-licenses-close'),
  openEula: document.getElementById('licenses-open-eula'),
  excerpt: document.getElementById('licenses-eula-excerpt')
};

let eulaText = '';

function openExternal(url) {
  // The shell is sandboxed without node; route links through the default
  // browser via the main process window-open handler.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function initEula() {
  const state = await window.aioscout.eula.getState();
  eulaText = state.text || '';
  licEls.gateText.innerHTML = renderMarkdown(eulaText);
  licEls.excerpt.innerHTML = renderMarkdown(eulaText.split('\n').slice(0, 6).join('\n'));
  if (!state.accepted) {
    licEls.gate.hidden = false;
  }
}

function acceptEula() {
  window.aioscout.eula.accept();
  licEls.gate.hidden = true;
}

if (licEls.accept) {
  licEls.accept.addEventListener('click', acceptEula);
  licEls.decline.addEventListener('click', () => window.aioscout.app.quit());
  licEls.licensesLink.addEventListener('click', () => { licEls.dialog.hidden = false; });
  licEls.navLicenses.addEventListener('click', () => { licEls.dialog.hidden = false; });
  licEls.dialogClose.addEventListener('click', () => { licEls.dialog.hidden = true; });
  licEls.openEula.addEventListener('click', () => { licEls.dialog.hidden = true; licEls.gate.hidden = false; licEls.gateText.focus(); });
  licEls.dialog.addEventListener('click', (e) => { if (e.target === licEls.dialog) licEls.dialog.hidden = true; });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-ext]');
    if (a) { e.preventDefault(); openExternal(a.dataset.ext); }
  });
  initEula();
}
