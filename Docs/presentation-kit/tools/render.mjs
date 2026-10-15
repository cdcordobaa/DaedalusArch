// Rasterise kit SVGs to PNG at 2x with Playwright (Chromium). Usage: node render.mjs <file.svg> [...]
// Needs NODE_PATH pointing at a node_modules with playwright 1.55.0 (kept outside the repository).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const files = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
for (const f of files) {
  const svg = fs.readFileSync(f, 'utf8');
  const w = Number(svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/)[1]);
  const h = Number(svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/)[1]);
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`);
  const out = f.replace(/\.svg$/, '.png');
  await page.locator('svg').first().screenshot({ path: out });
  process.stdout.write(`${path.basename(out)} ${w}x${h}\n`);
}
await browser.close();
