// LEONIDA LEDGER v3 — bootstrap: loads trophies.json, wires every control, hash routing.
import {
  loadState, saveState, resetState, cycleStatus, setStatus, getStatus, getCount, bumpCount,
  exportState, validateImport, loadTheme, saveTheme, stampSaved,
} from './store.js';
import {
  computeAudit, renderHeader, renderFilters, renderChecklist, renderNextUp,
  renderRoadmap, renderMatrix, renderMissables, renderProgress, detailHtml,
} from './views.js';

const data = await (await fetch('data/trophies.json')).json();
const audit = computeAudit(data);
let state = loadState();
const ui = { filter: 'all', grade: 'all', sort: 'roadmap', search: '', tab: 'checklist' };
let openDetailId = null;

const $ = (id) => document.getElementById(id);

function renderAll() {
  renderHeader(data, state, audit);
  renderFilters(data, state, ui);
  renderChecklist(data, state, ui);
  renderNextUp(data, state);
  renderRoadmap(data, state);
  renderMatrix(data, audit);
  renderMissables(data, state);
  renderProgress(data, state, audit);
  if (openDetailId != null) {
    const t = data.trophies.find((x) => x.id === openDetailId);
    if (t) $('detail').innerHTML = detailHtml(data, t, state);
  }
}

function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  const hash = new URLSearchParams(location.hash.slice(1));
  hash.set('tab', tab);
  history.replaceState(null, '', `#${hash.toString()}`);
}

export function openDetail(id) {
  const t = data.trophies.find((x) => x.id === id);
  if (!t) return;
  openDetailId = id;
  $('detail').innerHTML = detailHtml(data, t, state);
  $('detailOverlay').hidden = false;
  const hash = new URLSearchParams(location.hash.slice(1));
  hash.set('trophy', String(id));
  history.replaceState(null, '', `#${hash.toString()}`);
}

function closeDetail() {
  openDetailId = null;
  $('detailOverlay').hidden = true;
  const hash = new URLSearchParams(location.hash.slice(1));
  hash.delete('trophy');
  history.replaceState(null, '', `#${hash.toString()}`);
}

// Theme + spoilers
saveTheme(loadTheme());
$('themeToggle').addEventListener('click', () => {
  saveTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
function renderSpoilerBtn() {
  $('spoilerToggle').textContent = `Spoilers: ${state.spoilersHidden ? 'hidden' : 'shown'}`;
}
renderSpoilerBtn();
$('spoilerToggle').addEventListener('click', () => {
  state.spoilersHidden = !state.spoilersHidden;
  saveState(state);
  renderSpoilerBtn();
  renderAll();
});

// Tabs
document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

// Filters / sort / search / grade
$('filters').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  ui.filter = chip.dataset.filter;
  renderFilters(data, state, ui);
  renderChecklist(data, state, ui);
});
$('gradeFilter').addEventListener('change', (e) => {
  ui.grade = e.target.value;
  renderFilters(data, state, ui);
  renderChecklist(data, state, ui);
});
$('sortSelect').addEventListener('change', (e) => {
  ui.sort = e.target.value;
  renderChecklist(data, state, ui);
});
$('searchInput').addEventListener('input', (e) => {
  ui.search = e.target.value;
  renderFilters(data, state, ui);
  renderChecklist(data, state, ui);
});

// Export / import / reset
$('exportBtn').addEventListener('click', () => exportState(state));
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const res = validateImport(payload);
    if (!res.ok) { alert(`Import failed: ${res.error}`); return; }
    state = res.state;
    saveState(state);
    renderSpoilerBtn();
    renderAll();
  } catch {
    alert('Import failed: not valid JSON.');
  }
  e.target.value = '';
});
$('resetBtn').addEventListener('click', () => {
  if (!window.confirm('Reset all progress, counters and reveals?')) return;
  state = resetState();
  renderSpoilerBtn();
  renderAll();
});

// Missable banner
$('missableShow').addEventListener('click', (e) => {
  const id = Number(e.target.dataset.id);
  if (id) openDetail(id);
});

// Global click delegation: rows, next-up, missable cards, state cycle, counters, reveal, detail.
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    const id = Number(actionEl.dataset.id);
    if (action === 'cycle') {
      e.stopPropagation();
      cycleStatus(state, id);
      renderAll();
      return;
    }
    if (action === 'count-up' || action === 'count-down') {
      e.stopPropagation();
      const t = data.trophies.find((x) => x.id === id);
      if (t && t.counter) bumpCount(state, id, (action === 'count-up' ? 1 : -1) * t.counter.step, t.counter.target);
      renderAll();
      return;
    }
    if (action === 'reveal') {
      e.stopPropagation();
      state.revealed[String(id)] = true;
      saveState(state);
      renderAll();
      return;
    }
    if (action === 'mark-earned') {
      setStatus(state, id, getStatus(state, id) === 'earned' ? 'todo' : 'earned');
      renderAll();
      return;
    }
    if (action === 'close-detail') {
      closeDetail();
      return;
    }
  }
  const row = e.target.closest('[data-trow]');
  if (row) openDetail(Number(row.dataset.trow));
  const nu = e.target.closest('[data-nextup]');
  if (nu) openDetail(Number(nu.dataset.nextup));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const row = e.target.closest && e.target.closest('[data-trow]');
    if (row) openDetail(Number(row.dataset.trow));
  }
  if (e.key === 'Escape' && openDetailId != null) closeDetail();
});
$('detailOverlay').addEventListener('click', (e) => {
  if (e.target === $('detailOverlay')) closeDetail();
});

// Hash routing on load: #tab=roadmap&trophy=28
function applyHash() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const tab = hash.get('tab');
  if (tab && document.getElementById(`tab-${tab}`)) setTab(tab);
  const trophy = Number(hash.get('trophy'));
  if (trophy >= 1 && trophy <= 55) openDetail(trophy);
  else if (openDetailId != null) closeDetail();
}
applyHash();
window.addEventListener('hashchange', applyHash);

renderAll();
stampSaved();
