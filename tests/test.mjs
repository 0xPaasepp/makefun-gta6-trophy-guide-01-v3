// LEONIDA LEDGER v3 — Playwright tests for EVERY feature. Serves app/ on a local
// port and drives it in Chromium. Usage: node tests/test.mjs [--port 8124]
// Exits 0 only when every test passes.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/home/hatch/workspace/makefun/node_modules/playwright'));
}

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const data = JSON.parse(readFileSync(join(repo, 'app/data/trophies.json'), 'utf8'));
const port = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || 8124);
const BASE = `http://127.0.0.1:${port}`;

const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: repo, stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start: ${serverLog}`);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

let browser;
async function newPage(hash = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  const external = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) external.push(r.url()); });
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.trow', { timeout: 10000 });
  return { ctx, page, errors, failed, external };
}

const M = { 1: [1, 5], 2: [1, 5], 3: [1, 5], 4: [1, 5], 5: [1, 5], 6: [1, 5], 7: [1, 5], 8: [1, 5], 9: [1, 5], 10: [1, 5], 11: [1, 5], 12: [1, 5], 13: [1, 5], 14: [1, 2, 3, 5], 15: [1, 2, 3, 5, 8], 16: [1, 5], 17: [5, 8], 18: [5, 8], 19: [5, 8], 20: [1, 5, 8], 21: [1, 5], 22: [1, 5], 23: [1, 5], 24: [1, 5, 8], 25: [1, 2, 5, 8], 26: [1, 5], 27: [1, 5], 28: [1, 2, 3, 5, 8], 29: [1, 2, 5], 30: [5, 8], 31: [1, 5, 8], 32: [1, 2, 5, 8], 33: [1, 2, 5], 34: [1, 2, 5], 35: [1, 2, 5, 8], 36: [1, 2, 5], 37: [1, 2, 5, 8], 38: [1, 2, 5, 8], 39: [1, 2, 5], 40: [1, 2, 5, 8], 41: [1, 2, 5], 42: [1, 5, 8], 43: [1, 2, 5, 8], 44: [1], 45: [1], 46: [1, 2, 3, 5, 8], 47: [1, 2, 3, 5, 8], 48: [1, 2, 5, 8], 49: [], 50: [1], 51: [], 52: [1, 2, 5, 8], 53: [1, 2, 5], 54: [1, 2, 5, 8], 55: [1, 2, 5] };

async function run() {
  await waitForServer();
  browser = await chromium.launch();

  // 1. Clean load: 0 console errors, 0 failed requests, 0 external requests.
  {
    const { ctx, page, errors, failed, external } = await newPage();
    check('load: 0 console errors', errors.length === 0, errors.join(' | '));
    check('load: 0 failed requests', failed.length === 0, failed.join(', '));
    check('load: 0 external requests (offline)', external.length === 0, external.join(', '));
    await ctx.close();
  }

  // 2. Header starts at 0/55 and 0/1350 PSN pts.
  {
    const { ctx, page } = await newPage();
    check('header: 0/55 at start', (await page.textContent('#earnedCount')) === '0/55');
    check('header: 0/1350 PSN pts at start', (await page.textContent('#psnPoints')) === '0/1350 PSN pts');
    await ctx.close();
  }

  // 3. Audit strip numbers match trophies.json.
  {
    const { ctx, page } = await newPage();
    const audit = await page.textContent('#auditStrip');
    const totalSteps = data.trophies.reduce((a, t) => a + t.steps.length, 0);
    check('audit: 55 official + grades', audit.includes('55 official') && audit.includes('1P 2G 6S 46B'));
    check(`audit: ${totalSteps}/${totalSteps} steps cited`, audit.includes(`${totalSteps}/${totalSteps} steps cited`));
    check('audit: 1 possibly missable · 6 watch · 2 unconfirmed · 3 single-source · 14 disagree',
      audit.includes('1 possibly missable') && audit.includes('6 watch') && audit.includes('2 unconfirmed') &&
      audit.includes('3 single-source') && audit.includes('14 disagree'));
    const cited = await page.textContent('#citedByStrip');
    check('cited-by: [1] 55/55 [2] 50/55 [3] 50/55 [4] 32/55 [5] 50/55 [6] 0/55 [7] 20/55 [8] 50/55',
      cited.includes('[1] 55/55') && cited.includes('[2] 50/55') && cited.includes('[3] 50/55') &&
      cited.includes('[4] 32/55') && cited.includes('[5] 50/55') && cited.includes('[6] 0/55') &&
      cited.includes('[7] 20/55') && cited.includes('[8] 50/55'));
    await ctx.close();
  }

  // 4. Every filter chip changes the showing line / count.
  {
    const { ctx, page } = await newPage();
    const expected = {
      all: 55, story: 12, missable: 1, collectibles: 5, activities: 8, online: 0, side: 7,
      feats: 8, crime: 7, riddles: 4, money: 6, mystery: 5, unconfirmed: 2, todo: 55, earned: 0, quick: 6,
    };
    let allOk = true; let detail = '';
    for (const [key, n] of Object.entries(expected)) {
      await page.click(`[data-filter="${key}"]`);
      const line = await page.textContent('#showingLine');
      if (!line.startsWith(`Showing ${n} of 55`)) { allOk = false; detail = `${key}: got "${line}", want ${n}`; break; }
    }
    check('filters: every chip shows its live count', allOk, detail);
    await ctx.close();
  }

  // 5. Search + result count.
  {
    const { ctx, page } = await newPage();
    await page.fill('#searchInput', 'bowling');
    const line = await page.textContent('#showingLine');
    const rc = await page.textContent('#resultCount');
    check('search: "bowling" finds 1 trophy', line.startsWith('Showing 1 of 55') && rc.includes('1 match'), `${line} / ${rc}`);
    await page.fill('#searchInput', '');
    await ctx.close();
  }

  // 6-8. Sort orders.
  {
    const { ctx, page } = await newPage();
    await page.selectOption('#sortSelect', 'az');
    let first = await page.textContent('.trow >> nth=0');
    check('sort A-Z: first is A Classic Blitz Play', first.includes('A Classic Blitz Play'), first.slice(0, 60));
    await page.selectOption('#sortSelect', 'grade');
    first = await page.textContent('.trow >> nth=0');
    check('sort grade: first is the platinum', first.includes('Vice Got a Price!'), first.slice(0, 60));
    await page.selectOption('#sortSelect', 'difficulty');
    first = await page.textContent('.trow >> nth=0');
    check('sort difficulty: first row is difficulty 1', first.includes('Difficulty 1/5'), first.slice(0, 80));
    await ctx.close();
  }

  // 9. Grade filter.
  {
    const { ctx, page } = await newPage();
    await page.selectOption('#gradeFilter', 'bronze');
    const line = await page.textContent('#showingLine');
    check('grade filter bronze: 46 shown', line.startsWith('Showing 46 of 55'), line);
    await ctx.close();
  }

  // 10. 3-state persistence across reload.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-trow="2"] [data-action="cycle"]');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.trow');
    let btn = await page.getAttribute('[data-trow="2"] [data-action="cycle"]', 'data-state');
    check('3-state: in-progress persists across reload', btn === 'inprogress', `state=${btn}`);
    await page.click('[data-trow="2"] [data-action="cycle"]');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.trow');
    btn = await page.getAttribute('[data-trow="2"] [data-action="cycle"]', 'data-state');
    const head = await page.textContent('#earnedCount');
    check('3-state: earned persists across reload, header 1/55', btn === 'earned' && head === '1/55', `state=${btn} head=${head}`);
    await ctx.close();
  }

  // 11. Export -> reset -> import round-trip.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-trow="2"] [data-action="cycle"]');
    await page.click('[data-trow="2"] [data-action="cycle"]');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.click('#exportBtn'),
    ]);
    const path = await download.path();
    const exported = JSON.parse(readFileSync(path, 'utf8'));
    check('export: file is a v3 export with trophy 2 earned',
      exported.app === 'leonida-ledger-v3' && exported.status['2'] === 'earned', JSON.stringify(exported.status));
    page.on('dialog', (d) => d.accept());
    await page.click('#resetBtn');
    await page.waitForTimeout(300);
    let head = await page.textContent('#earnedCount');
    check('reset: back to 0/55 after confirm', head === '0/55', head);
    await page.setInputFiles('#importFile', path);
    await page.waitForTimeout(400);
    head = await page.textContent('#earnedCount');
    check('import: 1/55 restored after round-trip', head === '1/55', head);
    await ctx.close();
  }

  // 12. Spoiler toggle + per-row Reveal.
  {
    const { ctx, page } = await newPage();
    const maskedBefore = await page.locator('.spoiler-mask').count();
    check('spoilers: hidden rows masked by default', maskedBefore === 28, `masked=${maskedBefore}`);
    await page.click('[data-trow="2"] [data-action="reveal"]');
    const maskedAfter = await page.locator('.spoiler-mask').count();
    check('spoilers: Reveal unmasks one row', maskedAfter === 27, `masked=${maskedAfter}`);
    await page.click('#spoilerToggle');
    const maskedShown = await page.locator('.spoiler-mask').count();
    check('spoilers: toggle shows all hidden rows', maskedShown === 0, `masked=${maskedShown}`);
    await ctx.close();
  }

  // 13. NEXT UP recomputes after earning the first item.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-tab="nextup"]');
    let first = await page.textContent('#nextupList li >> nth=0');
    check('next up: first is #28 (missable) at start', first.includes('#28 Positive Mental Attitude'), first.slice(0, 80));
    await page.click('[data-tab="checklist"]');
    await page.click('[data-trow="28"] [data-action="cycle"]');
    await page.click('[data-trow="28"] [data-action="cycle"]');
    await page.click('[data-tab="nextup"]');
    first = await page.textContent('#nextupList li >> nth=0');
    check('next up: recomputes to #23 after #28 earned', first.includes('#23 This Was No Boat Accident'), first.slice(0, 80));
    await ctx.close();
  }

  // 14. Missable banner Show it opens the right detail.
  {
    const { ctx, page } = await newPage();
    await page.click('#missableShow');
    await page.waitForSelector('#detail h2');
    const h = await page.textContent('#detail h2');
    check('missable banner: Show it opens #28 detail', h.includes('Positive Mental Attitude'), h);
    await ctx.close();
  }

  // 15. Theme toggle switches light/dark and persists.
  {
    const { ctx, page } = await newPage();
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('#themeToggle');
    const dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.trow');
    const persisted = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check('theme: light default, dark after toggle, persists', before === 'light' && dark === 'dark' && persisted === 'dark', `${before}/${dark}/${persisted}`);
    await page.click('#themeToggle');
    await ctx.close();
  }

  // 16. Matrix counts match trophies.json (independent recompute).
  {
    const { ctx, page } = await newPage();
    await page.click('[data-tab="matrix"]');
    let ok = true; let detail = '';
    for (let n = 1; n <= 8; n++) {
      const guides = data.trophies.filter((t) => t.sources.includes(n)).length;
      const steps = data.trophies.reduce((a, t) => a + t.steps.filter((s) => s.cites.includes(n)).length, 0);
      const totalSteps = data.trophies.reduce((a, t) => a + t.steps.length, 0);
      const g = await page.textContent(`[data-matrix-guides="${n}"]`);
      const s = await page.textContent(`[data-matrix-steps="${n}"]`);
      if (g !== `${guides}/55` || s !== `${steps}/${totalSteps}`) { ok = false; detail = `source ${n}: ${g}/${s}`; break; }
    }
    check('matrix: counts match trophies.json recompute', ok, detail);
    const legend = await page.textContent('#confidenceLegend');
    check('matrix: confidence legend 39 green · 16 amber', legend.includes('39 green') && legend.includes('16 amber'), legend.slice(0, 120));
    await ctx.close();
  }

  // 17. Step citations resolve to a source listed for that trophy (0 mismatches).
  {
    // Strict rule: every step citation must be an M (full-method) source for that trophy.
    let strict = 0;
    for (const t of data.trophies) {
      for (const s of t.steps) {
        if (s.cites.length === 0) strict++;
        for (const c of s.cites) if (!M[t.id].includes(c)) strict++;
      }
    }
    check('citations: every step citation is an M source for that trophy (0 mismatches)', strict === 0, `${strict} bad`);
  }

  // 18. Counters step correctly and persist.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-trow="28"] [data-action="count-up"]');
    await page.click('[data-trow="28"] [data-action="count-up"]');
    let v = await page.textContent('[data-cval="28"]');
    check('counters: + twice gives 2/18', v.includes('2/18'), v);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.trow');
    v = await page.textContent('[data-cval="28"]');
    check('counters: value persists across reload', v.includes('2/18'), v);
    await page.click('[data-trow="28"] [data-action="count-down"]');
    v = await page.textContent('[data-cval="28"]');
    check('counters: − once gives 1/18', v.includes('1/18'), v);
    await ctx.close();
  }

  // 19. Detail opens for every trophy (all 55).
  {
    const { ctx, page } = await newPage();
    let ok = true; let detail = '';
    for (const t of data.trophies) {
      await page.goto(`${BASE}/#tab=checklist&trophy=${t.id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#detail h2', { timeout: 5000 });
      const h = await page.textContent('#detail h2');
      if (!h.includes(t.name)) { ok = false; detail = `#${t.id}: got "${h}"`; break; }
      const foot = await page.textContent('.d-foot');
      if (!foot.includes(`trophy ${t.id} of 55`)) { ok = false; detail = `#${t.id}: footer wrong`; break; }
    }
    check('detail: all 55 panels open with correct footer', ok, detail);
    await ctx.close();
  }

  // 20. Detail content: #49 not pinned down, #44 single-source + D7, #28 D1 resolved.
  {
    const { ctx, page } = await newPage();
    await page.goto(`${BASE}/#tab=checklist&trophy=49`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#detail h2');
    let txt = await page.textContent('#detail');
    check('detail #49: NOT PINNED DOWN YET shown', txt.includes('Not pinned down yet'), txt.slice(0, 100));
    await page.goto(`${BASE}/#tab=checklist&trophy=44`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#detail h2');
    txt = await page.textContent('#detail');
    check('detail #44: single-source + Sources differ D7', txt.includes('Single source') && txt.includes('Sources differ — D7'), txt.slice(0, 140));
    await page.goto(`${BASE}/#tab=checklist&trophy=28`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#detail h2');
    txt = await page.textContent('#detail');
    check('detail #28: D1 resolved note + D2 + D5', txt.includes('Resolved — not a disagreement') && txt.includes('Sources differ — D2') && txt.includes('Sources differ — D5'), txt.slice(0, 140));
    await ctx.close();
  }

  // 21. Roadmap tab shows 8 stages; progress tab shows bars; missables tab shows 9 disagreements.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-tab="roadmap"]');
    const stages = await page.locator('#roadmap .stage-head').count();
    check('roadmap: 8 stage groups', stages === 8, `stages=${stages}`);
    await page.click('[data-tab="progress"]');
    const bars = await page.locator('#progressView .bar').count();
    check('progress: grade + stage bars render', bars === 12, `bars=${bars}`);
    await page.click('[data-tab="missables"]');
    const dis = await page.locator('#disagreeList .box.diff').count();
    check('missables: 9 live disagreement boxes', dis === 9, `boxes=${dis}`);
    await ctx.close();
  }

  // 22. GOAL row / S0 header at top of checklist.
  {
    const { ctx, page } = await newPage();
    const firstHead = await page.textContent('.stage-head h3 >> nth=0');
    check('checklist: GOAL row at top', firstHead.includes('GOAL · 100% AND THE PLATINUM'), firstHead);
    await ctx.close();
  }

  // 23. Mark earned from detail updates the header.
  {
    const { ctx, page } = await newPage();
    await page.goto(`${BASE}/#tab=checklist&trophy=2`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#detail h2');
    await page.click('#markEarned');
    const head = await page.textContent('#earnedCount');
    check('detail: Mark earned updates header to 1/55', head === '1/55', head);
    await ctx.close();
  }

  // 24. Quick wins filter shows 6 at start.
  {
    const { ctx, page } = await newPage();
    await page.click('[data-filter="quick"]');
    const line = await page.textContent('#showingLine');
    check('quick wins: 6 shown at start', line.startsWith('Showing 6 of 55'), line);
    await ctx.close();
  }

  // 25. Data audit: 55 trophies, 28 hidden, 26 counters, PSN 1350.
  {
    const total = data.trophies.length;
    const hidden = data.trophies.filter((t) => t.hidden).length;
    const counters = data.trophies.filter((t) => t.counter).length;
    const pts = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
    const psn = data.trophies.reduce((a, t) => a + pts[t.grade], 0);
    check('data: 55 trophies, 28 hidden, 26 counters, PSN 1350',
      total === 55 && hidden === 28 && counters === 26 && psn === 1350, `${total}/${hidden}/${counters}/${psn}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
  await browser.close();
  server.kill();
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => {
  console.error('TEST RUNNER ERROR:', e);
  try { server.kill(); } catch { /* ignore */ }
  process.exit(2);
});
