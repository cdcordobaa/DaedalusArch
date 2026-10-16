/**
 * Architect HTML report in a real browser (Playwright, Chromium): the three reference variants render with no
 * horizontal overflow, no console error and no network request, at desktop, tablet and phone widths, and the filters
 * work. Needs a Chromium that playwright-core can launch (PLAYWRIGHT_BROWSERS_PATH); without one the suite skips,
 * unless HTML_REPORT_BROWSER_REQUIRED=1, which makes the missing browser a failure.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { architectReportHtml } from '../../../src/report/architect/index.js';
import { VARIANTS, reportInput } from '../../unit/report/architect-fixtures.js';
import type { Variant } from '../../unit/report/architect-fixtures.js';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 375, height: 812 },
] as const;

const executable = ((): string | undefined => {
  try {
    const p = chromium.executablePath();
    return existsSync(p) ? p : undefined;
  } catch {
    return undefined;
  }
})();
const required = process.env['HTML_REPORT_BROWSER_REQUIRED'] === '1';
const describeBrowser = executable !== undefined || required ? describe : describe.skip;

if (executable === undefined && !required) {
  process.stderr.write('architect-html.browser.test: no Chromium for playwright-core; suite skipped (set HTML_REPORT_BROWSER_REQUIRED=1 to fail instead)\n');
}

interface Opened {
  readonly page: Page;
  readonly errors: string[];
  readonly requests: string[];
}

describeBrowser('architect HTML report in Chromium', () => {
  let browser: Browser;
  let dir: string;
  const files = new Map<Variant, string>();

  beforeAll(async () => {
    browser = await chromium.launch();
    dir = mkdtempSync(join(tmpdir(), 'architect-browser-'));
    for (const v of VARIANTS) {
      const file = join(dir, `${v}.html`);
      writeFileSync(file, architectReportHtml(await reportInput(v)), 'utf-8');
      files.set(v, pathToFileURL(file).href);
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  async function open(variant: Variant, viewport: { width: number; height: number }): Promise<Opened> {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('request', (r) => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
    await page.goto(files.get(variant) ?? '', { waitUntil: 'load' });
    return { page, errors, requests };
  }

  for (const variant of VARIANTS) {
    for (const vp of VIEWPORTS) {
      it(`${variant} @ ${vp.name}: no overflow, no console error, no network`, async () => {
        const { page, errors, requests } = await open(variant, vp);
        try {
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            const width = doc.clientWidth;
            // Elements sticking out of the viewport, except inside a scroll container of their own.
            const scrollers = Array.from(document.querySelectorAll('pre, .diagram-scroll, .table-wrap'));
            const outside = Array.from(document.querySelectorAll('body *'))
              .filter((el) => !scrollers.some((s) => s !== el && s.contains(el)))
              .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > width + 0.5 || r.left < -0.5); })
              .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').replace(/\s+/g, '.')}`);
            // Content spilling out of a box that does not scroll (e.g. an unbreakable path in a paragraph).
            const spilling = Array.from(document.querySelectorAll('body *'))
              .filter((el) => !(el instanceof SVGElement) && !scrollers.some((s) => s !== el && s.contains(el)))
              .filter((el) => el.clientWidth > 0 && getComputedStyle(el).overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1)
              .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').replace(/\s+/g, '.')}`);
            return { scrollWidth: doc.scrollWidth, width, outside: outside.slice(0, 10), spilling: spilling.slice(0, 10) };
          });
          expect(overflow.outside).toEqual([]);
          expect(overflow.spilling).toEqual([]);
          expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width);
          expect(errors).toEqual([]);
          expect(requests).toEqual([]);
        } finally {
          await page.close();
        }
      }, 30_000);
    }
  }

  it('filters by tier, rule, layer, file and diagram edge', async () => {
    const { page, errors } = await open('variant-a-structural', VIEWPORTS[0]);
    try {
      const visible = (): Promise<number> => page.locator('.finding:not([hidden])').count();
      const total = await page.locator('.finding').count();
      expect(await visible()).toBe(total);

      await page.locator('[data-filter-tier="warning"]').uncheck();
      const defining = await visible();
      expect(defining).toBe(await page.locator('.finding[data-tier="defining"]').count());
      expect(await page.locator('#f-count').textContent()).toBe(`Showing ${String(defining)} of ${String(total)} findings`);

      await page.locator('#f-rule').selectOption('FF-S02');
      expect(await visible()).toBe(await page.locator('.finding[data-rule="FF-S02"]').count());

      await page.locator('#f-clear').click();
      expect(await visible()).toBe(total);

      await page.locator('.layer[data-layer="domain"]').click();
      expect(await page.locator('#f-layer').inputValue()).toBe('domain');
      const domainCards = await page.locator('.finding:not([hidden])').evaluateAll((els) => els.map((e) => e.getAttribute('data-layers') ?? ''));
      expect(domainCards.length).toBeGreaterThan(0);
      expect(domainCards.every((l) => l.split('|').includes('domain'))).toBe(true);

      await page.locator('.edge[data-edge="domain>infrastructure"]').click();
      const edgeCards = await page.locator('.finding:not([hidden])').evaluateAll((els) => els.map((e) => e.getAttribute('data-edges') ?? ''));
      expect(edgeCards.length).toBeGreaterThan(0);
      expect(edgeCards.every((l) => l.split('|').includes('domain>infrastructure'))).toBe(true);
      expect(await page.locator('#f-edge').isVisible()).toBe(true);

      await page.locator('#f-clear').click();
      await page.locator('#f-file').selectOption('src/domain/entities/Task.ts');
      const fileCards = await page.locator('.finding:not([hidden])').evaluateAll((els) => els.map((e) => e.getAttribute('data-files') ?? ''));
      expect(fileCards.length).toBeGreaterThan(0);
      expect(fileCards.every((l) => l.split('|').includes('src/domain/entities/Task.ts'))).toBe(true);

      for (const t of ['defining', 'warning', 'not-counted']) await page.locator(`[data-filter-tier="${t}"]`).uncheck();
      expect(await visible()).toBe(0);
      expect(await page.locator('#f-empty').isVisible()).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('shows plain tier labels and keeps rule ids out of the visible text', async () => {
    const { page } = await open('variant-b-pattern', VIEWPORTS[0]);
    try {
      const text = await page.locator('body').innerText();
      expect(text).toContain('defining rule (can fail)');
      expect(text).toContain('warning (never fails)');
      expect(text).not.toMatch(/FF-[A-Z]+\d/);
      expect(await page.locator('.finding h3').first().getAttribute('title')).toMatch(/^Rule id: FF-/);
    } finally {
      await page.close();
    }
  }, 30_000);
});
