// LEONIDA LEDGER v3 — state store: 3-state checklist, counters, theme, spoilers.
// Everything persists in localStorage; export/import/reset round-trip the same shape.
export const STATE_KEY = 'll3-state-v3';
export const THEME_KEY = 'll3-theme-v3';

export const EMPTY_STATE = () => ({ status: {}, counts: {}, revealed: {}, spoilersHidden: true });

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return EMPTY_STATE();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_STATE();
    return {
      status: parsed.status && typeof parsed.status === 'object' ? parsed.status : {},
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
      revealed: parsed.revealed && typeof parsed.revealed === 'object' ? parsed.revealed : {},
      spoilersHidden: parsed.spoilersHidden !== false,
    };
  } catch {
    return EMPTY_STATE();
  }
}

export function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  stampSaved();
}

// Fresh state, persisted. Used by the Reset button (after a confirm in app.js).
export function resetState() {
  const fresh = EMPTY_STATE();
  saveState(fresh);
  return fresh;
}

export function stampSaved() {
  const el = document.getElementById('savedStamp');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `Saved in this browser ${hh}:${mm}`;
}

export function getStatus(state, id) {
  return state.status[String(id)] || 'todo';
}

export function cycleStatus(state, id) {
  const key = String(id);
  const cur = getStatus(state, key);
  const next = cur === 'todo' ? 'inprogress' : cur === 'inprogress' ? 'earned' : 'todo';
  state.status[key] = next;
  saveState(state);
  return next;
}

export function setStatus(state, id, value) {
  state.status[String(id)] = value;
  saveState(state);
}

export function getCount(state, id) {
  return Number(state.counts[String(id)] || 0);
}

export function setCount(state, id, value, max) {
  const key = String(id);
  const clamped = Math.max(0, Math.min(max, value));
  state.counts[key] = clamped;
  saveState(state);
  return clamped;
}

export function bumpCount(state, id, delta, max) {
  return setCount(state, id, getCount(state, id) + delta, max);
}

export function exportState(state) {
  const payload = {
    app: 'leonida-ledger-v3',
    version: 1,
    exportedAt: new Date().toISOString(),
    status: state.status,
    counts: state.counts,
    revealed: state.revealed,
    spoilersHidden: state.spoilersHidden,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-ledger-v3-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return payload;
}

// Validate an imported payload. Returns { ok: true, state } or { ok: false, error }.
export function validateImport(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Not a JSON object.' };
  if (payload.app !== 'leonida-ledger-v3') return { ok: false, error: 'Not a LEONIDA LEDGER v3 export.' };
  const status = {};
  for (const [k, v] of Object.entries(payload.status || {})) {
    if (!/^\d+$/.test(k)) return { ok: false, error: `Bad trophy id ${k}.` };
    if (!['todo', 'inprogress', 'earned'].includes(v)) return { ok: false, error: `Bad status for trophy ${k}.` };
    status[k] = v;
  }
  const counts = {};
  for (const [k, v] of Object.entries(payload.counts || {})) {
    if (!/^\d+$/.test(k) || typeof v !== 'number' || v < 0) return { ok: false, error: `Bad counter for trophy ${k}.` };
    counts[k] = Math.floor(v);
  }
  const revealed = {};
  for (const [k, v] of Object.entries(payload.revealed || {})) {
    if (!/^\d+$/.test(k) || typeof v !== 'boolean') return { ok: false, error: `Bad reveal flag for trophy ${k}.` };
    revealed[k] = v;
  }
  return { ok: true, state: { status, counts, revealed, spoilersHidden: payload.spoilersHidden !== false } };
}

export function loadTheme() {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = `Theme: ${theme}`;
}
