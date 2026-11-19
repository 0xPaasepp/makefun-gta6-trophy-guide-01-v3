// LEONIDA LEDGER v3 — screenshots: serves app/ on a local port and takes the 4
// LIGHT-theme shots listed in shots.json (1280x720, JPEG quality 80, <=256 KiB).
// Usage: node scripts/shots.mjs [--port 8123]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
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
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
const port = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || 8123);

const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: repo, stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start on ${port}: ${serverLog}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const shot of shots) {
    await page.goto(`http://127.0.0.1:${port}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(shot.wait || '.trow', { timeout: 10000 });
    await page.waitForTimeout(400);
    const out = join(repo, 'screenshots', shot.file);
    await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
    const size = statSync(out).size;
    console.log(`${shot.file}: ${size} bytes${size > 262144 ? ' OVER 256 KiB!' : ''}`);
    if (size > 262144) throw new Error(`${shot.file} exceeds 256 KiB`);
  }
  if (errors.length) throw new Error(`console errors during shots: ${errors.join(' | ')}`);
  await browser.close();
  console.log('shots done, 0 console errors');
} finally {
  server.kill();
}
