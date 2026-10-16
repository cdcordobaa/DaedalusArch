/**
 * Screenshots of the architect HTML report for Docs/v1.3/html-report.md, rendered from the reference variants of the
 * snapshot tests (tests/fixtures/html-report). Needs a Chromium that playwright-core can launch.
 *
 * Usage: npx tsx scripts/v1.3/html-report-screenshots.ts [--out docs/images]
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import type { Page } from 'playwright-core';
import { parseSpec } from '../../src/spec-parser/index.js';
import { architectReportHtml } from '../../src/report/architect/index.js';
import type { ArchitectGraphInput } from '../../src/report/architect/index.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';

interface Shot {
  readonly variant: string;
  readonly name: string;
  readonly width: number;
  /** Selector to clip to; the first screen when absent. */
  readonly clip?: string;
  readonly before?: (page: Page) => Promise<void>;
}

const SHOTS: readonly Shot[] = [
  { variant: 'variant-a-structural', name: 'html-report-summary.png', width: 1280, clip: 'section.summary' },
  { variant: 'variant-a-structural', name: 'html-report-diagram.png', width: 1280, clip: 'section.diagram' },
  { variant: 'variant-a-structural', name: 'html-report-finding.png', width: 1280, clip: '.finding[data-tier="defining"]' },
  {
    variant: 'variant-b-pattern', name: 'html-report-filters.png', width: 1280, clip: 'section.findings',
    before: async (page) => {
      await page.locator('[data-filter-tier="warning"]').uncheck();
      await page.locator('#f-layer').selectOption('domain');
    },
  },
  { variant: 'correct-reference', name: 'html-report-clean.png', width: 1280, clip: 'section.summary' },
  { variant: 'variant-a-structural', name: 'html-report-phone.png', width: 375 },
];

async function main(argv: readonly string[]): Promise<number> {
  const at = argv.indexOf('--out');
  const outDir = resolve(at >= 0 ? (argv[at + 1] ?? '') : 'docs/images');
  mkdirSync(outDir, { recursive: true });
  const parsed = await parseSpec({ specFilePath: 'specs/clean-arch.yaml' });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  const tmp = mkdtempSync(join(tmpdir(), 'architect-shots-'));
  const browser = await chromium.launch();
  try {
    const urls = new Map<string, string>();
    for (const v of new Set(SHOTS.map((s) => s.variant))) {
      const fx = JSON.parse(readFileSync(join('tests/fixtures/html-report', `${v}.json`), 'utf-8')) as {
        report: EvaluationReport; graph: ArchitectGraphInput; spec: string;
      };
      const file = join(tmp, `${v}.html`);
      writeFileSync(file, architectReportHtml({
        report: fx.report, spec: parsed.data, graph: fx.graph, projectRoot: resolve('fixtures', v), projectName: v, specPath: fx.spec,
      }), 'utf-8');
      urls.set(v, pathToFileURL(file).href);
    }
    for (const s of SHOTS) {
      const page = await browser.newPage({ viewport: { width: s.width, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1 });
      await page.goto(urls.get(s.variant) ?? '');
      if (s.before !== undefined) await s.before(page);
      const path = join(outDir, s.name);
      if (s.clip !== undefined) await page.locator(s.clip).first().screenshot({ path });
      else await page.screenshot({ path });
      await page.close();
      process.stderr.write(`${path}\n`);
    }
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  return 0;
}

main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
