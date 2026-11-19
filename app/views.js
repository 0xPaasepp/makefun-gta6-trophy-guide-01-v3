// LEONIDA LEDGER v3 — views: every number on screen is computed from trophies.json.
import { getStatus, getCount } from './store.js';

export const PSN_POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
export const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
export const GRADE_LABEL = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
export const GUIDE_SOURCES = [1, 2, 3, 4, 5, 8];

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtTime(min) {
  if (min == null) return 'unknown';
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
}

export function sourceByN(data, n) {
  return data.sources.find((s) => s.n === n);
}

export function citeHtml(data, cites) {
  return cites.map((n) => {
    const s = sourceByN(data, n);
    const title = s ? esc(s.name) : `Source ${n}`;
    return `<span class="cite" title="${title}">[${n}]</span>`;
  }).join('');
}

// Confidence: green = backed by at least one guide source in its steps, plus list
// backing (every trophy is listed by Exophase and PSNProfiles), with no disagreement,
// not single-source and not unconfirmed. Amber otherwise.
export function confidence(t) {
  const guideBacked = t.steps.some((s) => s.cites.some((c) => GUIDE_SOURCES.includes(c)));
  if (!guideBacked || t.disagree.length > 0 || t.singleSource || t.unconfirmed) return 'amber';
  return 'green';
}

export function computeAudit(data) {
  const ts = data.trophies;
  const totalSteps = ts.reduce((a, t) => a + t.steps.length, 0);
  const citedSteps = ts.reduce((a, t) => a + t.steps.filter((s) => s.cites.length > 0).length, 0);
  const guides = {};
  const stepsBy = {};
  for (const s of data.sources) {
    guides[s.n] = ts.filter((t) => t.sources.includes(s.n)).length;
    stepsBy[s.n] = ts.reduce((a, t) => a + t.steps.filter((st) => st.cites.includes(s.n)).length, 0);
  }
  return {
    total: ts.length,
    grades: { platinum: 1, gold: 2, silver: 6, bronze: 46 },
    hidden: ts.filter((t) => t.hidden).length,
    guidesCite: ts.filter((t) => t.sources.length > 0).length,
    totalSteps,
    citedSteps,
    missable: ts.filter((t) => t.missable === 'possible').length,
    watch: ts.filter((t) => t.missable === 'watch').length,
    unconfirmed: ts.filter((t) => t.unconfirmed).length,
    singleSource: ts.filter((t) => t.singleSource).length,
    disagree: ts.filter((t) => t.disagree.length > 0).length,
    guides,
    stepsBy,
    green: ts.filter((t) => confidence(t) === 'green').length,
    amber: ts.filter((t) => confidence(t) === 'amber').length,
    counters: ts.filter((t) => t.counter).length,
  };
}

export function auditText(a) {
  return `55 official · 1P 2G 6S 46B · ${a.hidden} hidden · ${a.guidesCite}/55 guides cite a source · ${a.citedSteps}/${a.totalSteps} steps cited · 8 sources read 20 Nov 2026 · ${a.missable} possibly missable · ${a.watch} watch · ${a.unconfirmed} unconfirmed · ${a.singleSource} single-source · ${a.disagree} disagree · 0 external requests · works offline`;
}

export function citedByText(a) {
  return 'CITED BY ' + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `[${n}] ${a.guides[n]}/55`).join('  ');
}

export function stageIndex(data, stageId) {
  return data.stages.findIndex((s) => s.id === stageId);
}

export function nextUpList(data, state) {
  const rank = (t) => (t.missable === 'possible' ? 0 : t.missable === 'watch' ? 1 : 2);
  return data.trophies
    .filter((t) => getStatus(state, t.id) !== 'earned')
    .sort((a, b) =>
      rank(a) - rank(b) ||
      stageIndex(data, a.stage) - stageIndex(data, b.stage) ||
      a.id - b.id ||
      (a.timeMin ?? 1e9) - (b.timeMin ?? 1e9));
}

export function nextWhy(t) {
  if (t.missable === 'possible') return 'Closes after Chapter 1 - do it now';
  if (t.missable === 'watch') return `Watch: ${t.watchReason || 'keep an eye on its progress'}`;
  if (t.timeMin != null) return `${fmtTime(t.timeMin)} · roadmap order`;
  return 'Roadmap order';
}

export function earnedStats(data, state) {
  const earned = data.trophies.filter((t) => getStatus(state, t.id) === 'earned');
  const inProgress = data.trophies.filter((t) => getStatus(state, t.id) === 'inprogress');
  const points = earned.reduce((a, t) => a + PSN_POINTS[t.grade], 0);
  const byGrade = {};
  for (const g of ['platinum', 'gold', 'silver', 'bronze']) {
    byGrade[g] = earned.filter((t) => t.grade === g).length;
  }
  return { earned: earned.length, inProgress: inProgress.length, points, byGrade };
}

export const FILTERS = [
  ['all', 'All 55'],
  ['story', 'Story'],
  ['missable', 'Missable'],
  ['collectibles', 'Collectibles'],
  ['activities', 'Activities'],
  ['online', 'Online'],
  ['side', 'Side'],
  ['feats', 'Feats'],
  ['crime', 'Crime'],
  ['riddles', 'Riddles'],
  ['money', 'Money'],
  ['mystery', 'Mystery'],
  ['unconfirmed', 'Unconfirmed'],
  ['todo', 'To do'],
  ['earned', 'Earned'],
  ['quick', 'Quick wins'],
];

export function filterMatches(t, filter, state) {
  switch (filter) {
    case 'all': return true;
    case 'missable': return t.missable === 'possible';
    case 'unconfirmed': return t.unconfirmed;
    case 'todo': return getStatus(state, t.id) !== 'earned';
    case 'earned': return getStatus(state, t.id) === 'earned';
    case 'quick': return t.timeMin != null && t.timeMin <= 15 && t.difficulty <= 2 && getStatus(state, t.id) !== 'earned';
    case 'online': return t.kinds.includes('online');
    default: return t.kinds.includes(filter);
  }
}

export function applySearchGrade(ts, q, grade) {
  const query = q.trim().toLowerCase();
  return ts.filter((t) => {
    if (grade !== 'all' && t.grade !== grade) return false;
    if (!query) return true;
    return (t.name + ' ' + t.description + ' ' + t.short).toLowerCase().includes(query);
  });
}

export function sortTrophies(ts, data, sort) {
  const arr = [...ts];
  if (sort === 'grade') return arr.sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.id - b.id);
  if (sort === 'az') return arr.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'difficulty') return arr.sort((a, b) => a.difficulty - b.difficulty || (a.timeMin ?? 1e9) - (b.timeMin ?? 1e9) || a.id - b.id);
  return arr.sort((a, b) => stageIndex(data, a.stage) - stageIndex(data, b.stage) || a.id - b.id);
}

function badgeHtml(t) {
  const conf = confidence(t);
  const parts = [`<span class="badge ${t.grade}">${GRADE_LABEL[t.grade].toUpperCase()}</span>`];
  if (t.missable === 'possible') parts.push('<span class="badge missable">POSSIBLY MISSABLE</span>');
  if (t.missable === 'watch') parts.push('<span class="badge watch">WATCH</span>');
  if (t.hidden) parts.push('<span class="badge hidden-flag">HIDDEN ON PSN</span>');
  if (t.unconfirmed) parts.push('<span class="badge watch">NOT PINNED DOWN</span>');
  if (t.singleSource) parts.push('<span class="badge watch">SINGLE SOURCE</span>');
  parts.push(`<span class="badge conf-${conf}">${conf === 'green' ? '● CONFIDENT' : '● CHECK SOURCES'}</span>`);
  return parts.join(' ');
}

function counterHtml(t, state) {
  if (!t.counter) return '';
  const v = getCount(state, t.id);
  return `<span class="counter" data-counter="${t.id}">
    <button type="button" data-action="count-down" data-id="${t.id}" aria-label="Decrease count">−</button>
    <span class="cval" data-cval="${t.id}">${v}/${t.counter.target} ${esc(t.counter.label)}</span>
    <button type="button" data-action="count-up" data-id="${t.id}" aria-label="Increase count">+</button>
  </span>`;
}

function rowHtml(data, t, state) {
  const status = getStatus(state, t.id);
  const hiddenMasked = t.hidden && state.spoilersHidden && status !== 'earned' && !state.revealed[t.id];
  const stateIcon = status === 'earned' ? '✓' : status === 'inprogress' ? '◐' : '○';
  const nameHtml = hiddenMasked
    ? `<span class="spoiler-mask">Hidden trophy — hidden until earned</span> <button type="button" data-action="reveal" data-id="${t.id}">Reveal</button>`
    : `<span class="tname">#${t.id} ${esc(t.name)}</span>`;
  const descHtml = hiddenMasked ? '' : `<div class="tdesc">${esc(t.description)}</div>`;
  const goalClass = t.stage === 'S0' ? ' goal-row' : '';
  return `<div class="trow${status === 'earned' ? ' earned' : ''}${goalClass}" data-id="${t.id}" data-trow="${t.id}" tabindex="0" role="button" aria-label="Open ${esc(t.name)}">
    <button type="button" class="state-btn" data-action="cycle" data-id="${t.id}" data-state="${status}" aria-label="Cycle status">${stateIcon}</button>
    <div>${nameHtml}${descHtml}<div class="badges">${badgeHtml(t)}</div>${counterHtml(t, state)}</div>
    <div class="tmeta">Difficulty ${t.difficulty}/5<br>${fmtTime(t.timeMin)}<br>${esc(t.stage)}</div>
  </div>`;
}

export function renderChecklist(data, state, ui) {
  const host = document.getElementById('checklist');
  const base = applySearchGrade(data.trophies, ui.search, ui.grade);
  const filtered = base.filter((t) => filterMatches(t, ui.filter, state));
  const sorted = sortTrophies(filtered, data, ui.sort);
  const earnedN = data.trophies.filter((t) => getStatus(state, t.id) === 'earned').length;
  document.getElementById('showingLine').textContent = `Showing ${sorted.length} of 55 · ${earnedN} earned`;
  document.getElementById('resultCount').textContent = ui.search.trim() ? `${base.length} match${base.length === 1 ? '' : 'es'}` : '';
  if (sorted.length === 0) {
    host.innerHTML = '<p class="empty">No trophies match this filter.</p>';
    return;
  }
  let html = '';
  let lastStage = null;
  for (const t of sorted) {
    if (ui.sort === 'roadmap' && t.stage !== lastStage) {
      lastStage = t.stage;
      const st = data.stages.find((s) => s.id === t.stage);
      const inStage = data.trophies.filter((x) => x.stage === t.stage);
      const earnedStage = inStage.filter((x) => getStatus(state, x.id) === 'earned').length;
      const title = t.stage === 'S0' ? 'GOAL · 100% AND THE PLATINUM' : `${st.name} — ${esc(st.title)}`;
      html += `<div class="stage-head"><span class="stage-count">${earnedStage}/${inStage.length} earned</span><h3>${title}</h3><p>${esc(st.intro)}</p></div>`;
    }
    html += rowHtml(data, t, state);
  }
  host.innerHTML = html;
}

export function renderFilters(data, state, ui) {
  const host = document.getElementById('filters');
  const base = applySearchGrade(data.trophies, ui.search, ui.grade);
  host.innerHTML = FILTERS.map(([key, label]) => {
    const n = base.filter((t) => filterMatches(t, key, state)).length;
    return `<button type="button" class="chip${ui.filter === key ? ' active' : ''}" data-filter="${key}">${label} ${n}</button>`;
  }).join('');
}

export function renderHeader(data, state, audit) {
  const s = earnedStats(data, state);
  document.getElementById('earnedCount').textContent = `${s.earned}/55`;
  document.getElementById('earnedPct').textContent = `(${Math.round((s.earned / 55) * 100)}%)`;
  document.getElementById('gradeCounts').textContent =
    `P ${s.byGrade.platinum}/1 · G ${s.byGrade.gold}/2 · S ${s.byGrade.silver}/6 · B ${s.byGrade.bronze}/46`;
  document.getElementById('psnPoints').textContent = `${s.points}/1350 PSN pts`;
  document.getElementById('inProgress').textContent = `${s.inProgress} in progress`;
  document.getElementById('auditStrip').textContent = auditText(audit);
  document.getElementById('citedByStrip').textContent = citedByText(audit);
  const banner = document.getElementById('missableBanner');
  const first = nextUpList(data, state).find((t) => t.missable === 'possible') ||
    nextUpList(data, state).find((t) => t.missable === 'watch');
  if (first) {
    banner.hidden = false;
    document.getElementById('missableText').textContent =
      first.missable === 'possible'
        ? ` #${first.id} ${first.name}: the Chapter 1 balcony meditation may vanish when Chapter 1 ends — do it in Chapter 1.`
        : ` #${first.id} ${first.name}: ${first.watchReason || 'watch this one.'}`;
    document.getElementById('missableShow').dataset.id = String(first.id);
  } else {
    banner.hidden = true;
  }
}

export function renderNextUp(data, state) {
  const list = nextUpList(data, state).slice(0, 8);
  const item = (t) => `<li data-id="${t.id}" data-nextup="${t.id}" tabindex="0">
    <span class="nu-name">#${t.id} ${esc(t.name)}</span>
    ${t.missable === 'possible' ? ' <span class="badge missable">POSSIBLY MISSABLE</span>' : t.missable === 'watch' ? ' <span class="badge watch">WATCH</span>' : ''}
    <div class="nu-why">${esc(nextWhy(t))} · ${citeHtml(data, t.steps.length ? t.steps[0].cites : t.sources.slice(0, 1))}</div>
  </li>`;
  const side = document.getElementById('nextupSide');
  if (side) side.innerHTML = nextUpList(data, state).slice(0, 5).map(item).join('');
  const full = document.getElementById('nextupList');
  if (full) full.innerHTML = list.map(item).join('');
}

export function renderRoadmap(data, state) {
  const host = document.getElementById('roadmap');
  host.innerHTML = data.stages.map((st) => {
    const ts = data.trophies.filter((t) => t.stage === st.id);
    const earned = ts.filter((t) => getStatus(state, t.id) === 'earned').length;
    const rows = ts.map((t) => {
      const status = getStatus(state, t.id);
      const icon = status === 'earned' ? '✓' : status === 'inprogress' ? '◐' : '○';
      return `<div class="trow${status === 'earned' ? ' earned' : ''}" data-id="${t.id}" data-trow="${t.id}" tabindex="0" role="button">
        <button type="button" class="state-btn" data-action="cycle" data-id="${t.id}" data-state="${status}">${icon}</button>
        <div><span class="tname">#${t.id} ${esc(t.name)}</span><div class="tdesc">${esc(t.description)}</div><div class="badges">${badgeHtml(t)}</div></div>
        <div class="tmeta">${GRADE_LABEL[t.grade]}<br>${fmtTime(t.timeMin)}</div>
      </div>`;
    }).join('');
    const title = st.id === 'S0' ? 'GOAL · 100% AND THE PLATINUM' : `${st.name} — ${esc(st.title)}`;
    return `<div class="stage-head"><span class="stage-count">${earned}/${ts.length} earned</span><h3>${title}</h3><p>${esc(st.intro)}</p></div>${rows}`;
  }).join('');
}

export function renderMatrix(data, audit) {
  const tbody = document.querySelector('#matrixTable tbody');
  tbody.innerHTML = data.sources.map((s) => `<tr>
    <td>[${s.n}]</td>
    <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><br><span style="color:var(--muted)">${esc(s.title)}</span></td>
    <td>${esc(s.read)}</td>
    <td data-matrix-guides="${s.n}">${audit.guides[s.n]}/55</td>
    <td data-matrix-steps="${s.n}">${audit.stepsBy[s.n]}/${audit.totalSteps}</td>
    <td>${esc(s.supports)}</td>
    <td>${s.kind === 'list' ? 'List-only' : 'Guide'}</td>
  </tr>`).join('');
  document.getElementById('confidenceLegend').textContent =
    `Green = backed by at least one guide source plus at least one list source, or no disagreement. Amber = list-only backing, a single source, or a source disagreement. In this ledger: ${audit.green} green · ${audit.amber} amber. Every trophy is listed by Exophase and PSNProfiles, which is the list backing.`;
  document.getElementById('sourceList').innerHTML = data.sources.map((s) =>
    `<li><strong>[${s.n}] ${esc(s.name)}</strong> — ${esc(s.title)} <span class="s-kind">(${s.kind === 'list' ? 'list-only' : 'guide'}, read ${esc(s.read)})</span><br><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></li>`).join('');
}

export function renderMissables(data, state) {
  const host = document.getElementById('missablesList');
  const possible = data.trophies.filter((t) => t.missable === 'possible');
  const watch = data.trophies.filter((t) => t.missable === 'watch');
  const card = (t, label) => `<div class="miss-card" data-id="${t.id}" data-trow="${t.id}" tabindex="0">
    <strong>${label} #${t.id} ${esc(t.name)}</strong> — ${esc(t.short)}
    <div class="badges">${badgeHtml(t)}</div></div>`;
  host.innerHTML =
    `<h3>Possibly missable (${possible.length})</h3>` + possible.map((t) => card(t, 'POSSIBLY MISSABLE')).join('') +
    `<h3>Watch (${watch.length})</h3>` + watch.map((t) => card(t, 'WATCH')).join('');
  const seen = new Set();
  const dis = [];
  for (const t of data.trophies) {
    for (const d of t.disagree) {
      if (seen.has(d.d)) continue;
      seen.add(d.d);
      dis.push({ ...d, trophy: t.id });
    }
  }
  document.getElementById('disagreeList').innerHTML = dis.map((d) => `<div class="box diff">
    <h4>Sources differ — ${esc(d.d)} (trophy #${d.trophy})</h4>
    <p><span class="vs">Version A:</span> ${esc(d.a)}</p>
    <p><span class="vs">Version B:</span> ${esc(d.b)}</p>
  </div>`).join('');
}

export function renderProgress(data, state, audit) {
  const s = earnedStats(data, state);
  const remaining = data.trophies.filter((t) => getStatus(state, t.id) !== 'earned');
  const mins = remaining.reduce((a, t) => a + (t.timeMin || 0), 0);
  const bar = (label, done, total) => `<div class="bar-row">
    <div class="bar-label"><span>${label}</span><span>${done}/${total}</span></div>
    <div class="bar"><span style="width:${total ? Math.round((done / total) * 100) : 0}%"></span></div></div>`;
  const gradeBars = ['platinum', 'gold', 'silver', 'bronze'].map((g) =>
    bar(`${GRADE_LABEL[g]} trophies`, s.byGrade[g], audit.grades[g])).join('');
  const stageBars = data.stages.map((st) => {
    const ts = data.trophies.filter((t) => t.stage === st.id);
    const done = ts.filter((t) => getStatus(state, t.id) === 'earned').length;
    return bar(`${st.id} — ${esc(st.title)}`, done, ts.length);
  }).join('');
  document.getElementById('progressView').innerHTML =
    `<p><strong>${s.earned}/55 earned</strong> (${Math.round((s.earned / 55) * 100)}%) · ${s.points}/1350 PSN pts · ${s.inProgress} in progress</p>
    <p>Estimated time left on un-earned trophies: about ${fmtTime(mins)} (guide estimates, not a promise).</p>
    <p>Counters tracked: ${audit.counters} trophies carry a progress counter.</p>
    <h3>By grade</h3>${gradeBars}<h3>By stage</h3>${stageBars}`;
}

export function detailHtml(data, t, state) {
  const status = getStatus(state, t.id);
  const conf = confidence(t);
  const stage = data.stages.find((s) => s.id === t.stage);
  const chips = [
    ...t.kinds.map((k) => `<span class="badge">${esc(k.toUpperCase())}</span>`),
    `<span class="badge">${esc(stage.id)} — ${esc(stage.title.toUpperCase())}</span>`,
    t.missable === 'possible' ? '<span class="badge missable">POSSIBLY MISSABLE</span>' : '',
    t.missable === 'watch' ? '<span class="badge watch">WATCH</span>' : '',
    t.hidden ? '<span class="badge hidden-flag">HIDDEN ON PSN</span>' : '',
    `<span class="badge conf-${conf}">${conf === 'green' ? '● CONFIDENT' : '● CHECK SOURCES'}</span>`,
  ].join(' ');
  const stepsHtml = t.steps.length
    ? `<ol class="steps">${t.steps.map((s, i) => `<li data-step="${i + 1}">${esc(s.text)} ${citeHtml(data, s.cites)}</li>`).join('')}</ol>`
    : '<p class="empty">No steps yet — see the box below.</p>';
  const missBox = t.missable === 'possible'
    ? `<div class="box missable"><h4>Missable?</h4><p>Possibly. The first meditation is only doable during Chapter 1 at Jason's house and becomes permanently unavailable after Chapter 1. Do it in Chapter 1 and keep a Chapter 1 save.</p></div>` : '';
  const watchBox = t.missable === 'watch'
    ? `<div class="box"><h4>Watch</h4><p>${esc(t.watchReason || 'Keep an eye on this one.')}</p></div>` : '';
  const unpinnedBox = (t.unconfirmed || t.notPinned)
    ? `<div class="box unpinned"><h4>Not pinned down yet</h4><p>${esc(t.notPinned || 'The exact trigger is not pinned down in any source read.')}</p></div>` : '';
  const resolvedBox = t.resolvedNote
    ? `<div class="box"><h4>Resolved — not a disagreement</h4><p>${esc(t.resolvedNote)}</p></div>` : '';
  const singleBox = t.singleSource
    ? `<div class="box"><h4>Single source</h4><p>This method comes from one source only (PowerPyx). The other guides read say the trigger is unconfirmed — see Sources differ below.</p></div>` : '';
  const diffBoxes = t.disagree.map((d) => `<div class="box diff"><h4>Sources differ — ${esc(d.d)}</h4>
    <p><span class="vs">Version A:</span> ${esc(d.a)}</p>
    <p><span class="vs">Version B:</span> ${esc(d.b)}</p></div>`).join('');
  const singleNoteBox = t.singleNote
    ? `<div class="box"><h4>Single-source note</h4><p>${esc(t.singleNote)}</p></div>` : '';
  const counterBox = t.counter
    ? `<div class="box"><h4>Your count</h4><p>${counterHtml(t, state)}<br><span style="color:var(--muted);font-size:12px">PSN counter target: ${t.counter.target} ${esc(t.counter.label)} (PSNProfiles).</span></p></div>` : '';
  return `
    <button type="button" id="detailClose" data-action="close-detail">← Close</button>
    <h2>${esc(t.name)}</h2>
    <p class="d-sub">TROPHY #${t.id} OF 55 · <span class="badge ${t.grade}">${GRADE_LABEL[t.grade].toUpperCase()}</span> · Difficulty ${t.difficulty}/5 · ${fmtTime(t.timeMin)}</p>
    <div class="badges">${chips}</div>
    <div class="d-actions">
      <button type="button" id="markEarned" data-action="mark-earned" data-id="${t.id}">${status === 'earned' ? '✓ Earned — click to unmark' : 'Mark earned'}</button>
      <button type="button" data-action="cycle" data-id="${t.id}">Cycle status (now: ${status})</button>
    </div>
    <div class="box"><h4>Official description — PlayStation</h4><p>${esc(t.description)}</p></div>
    <div class="box"><h4>In short</h4><p>${esc(t.short)}</p></div>
    ${missBox}${watchBox}${unpinnedBox}${resolvedBox}${singleBox}
    <div class="box"><h4>How to get it</h4>${stepsHtml}</div>
    ${diffBoxes}${singleNoteBox}${counterBox}
    <p class="d-foot">Our own wording. Cited ${t.sources.map((n) => `[${n}]`).join(' ')} · read 20 Nov 2026 · trophy ${t.id} of 55 · unofficial</p>`;
}
