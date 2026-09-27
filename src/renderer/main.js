// Shell renderer: navigation, service status, training progress panel,
// and reporting the subpage content bounds to the main process.

const els = {
  nav: document.getElementById('nav'),
  navLinks: {
    training: document.getElementById('nav-training'),
    coding: document.getElementById('nav-coding')
  },
  chips: {
    training: document.getElementById('chip-training'),
    mixly: document.getElementById('chip-mixly')
  },
  host: document.getElementById('subpage-host'),
  panels: {
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

let activePage = 'training';
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
  const showTraining =
    activePage === 'training' && (serviceStates.training !== 'ready' || trainingPhase === 'failed');
  const showCoding = activePage === 'coding' && serviceStates.mixly !== 'ready';
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
  // Default landing tab is AI Training; tell main so it can attach the view
  // as soon as the backend is ready.
  window.aioscout.nav.show('training');
})();
