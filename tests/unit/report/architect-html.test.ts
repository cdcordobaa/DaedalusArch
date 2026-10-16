/**
 * Architect HTML report (`evaluate --html`): snapshot tests on the three reference variants (one clean, two
 * violating) plus checks of the model against the v1.3 tiered scoring of the same run.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { architectReportHtml, buildArchitectModel, TIER_LABELS, writeArchitectReport } from '../../../src/report/architect/index.js';
import { esc } from '../../../src/report/architect/render.js';
import { isReadableSource, realSourcePath, SourceReader } from '../../../src/report/architect/excerpt.js';
import { plainRule, withoutRuleIds } from '../../../src/report/architect/rule-text.js';
import { REPO_ROOT, VARIANTS, loadFixture, reportInput } from './architect-fixtures.js';

/** The visible text of a page: tags, comments, scripts, styles and attribute values removed. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

describe('architect HTML report: reference variants', () => {
  it.each(VARIANTS)('%s matches its snapshot', async (variant) => {
    const html = architectReportHtml(await reportInput(variant));
    expect(html).toMatchSnapshot();
  });

  it.each(VARIANTS)('%s is deterministic', async (variant) => {
    const input = await reportInput(variant);
    expect(architectReportHtml(input)).toBe(architectReportHtml(input));
  });

  it.each(VARIANTS)('%s: tiers agree with the v1.3 scoring of the run', async (variant) => {
    const input = await reportInput(variant);
    const model = buildArchitectModel(input);
    const tiers = loadFixture(variant).report.tiers;
    expect(tiers).toBeDefined();
    if (tiers === undefined) return;
    expect(model.summary.verdict).toBe(tiers.verdict);
    expect(model.summary.counts.defining).toBe(tiers.blocking.violationCount);
    expect(model.summary.blockers.map((b) => b.ruleId)).toEqual(tiers.blocking.rules.filter((r) => r.violated).map((r) => String(r.functionId)));
    expect(model.findings).toHaveLength(input.report.violations.length);
  });

  it.each(VARIANTS)('%s: rule ids appear in tooltips only', async (variant) => {
    const html = architectReportHtml(await reportInput(variant));
    expect(visibleText(html)).not.toMatch(/FF-[A-Z]+\d/);
    expect(html).toMatch(/title="Rule id: FF-[A-Z]+\d+"/);
  });

  it.each(VARIANTS)('%s is self-contained (no external URL, CSP blocks the network)', async (variant) => {
    const html = architectReportHtml(await reportInput(variant));
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
    expect(html).not.toMatch(/@import|url\(\s*["']?https?:/i);
    expect(html).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:"`);
  });

  it('clean variant passes with nothing blocking', async () => {
    const model = buildArchitectModel(await reportInput('correct-reference'));
    expect(model.summary.verdict).toBe('pass');
    expect(model.summary.blockers).toEqual([]);
    expect(model.summary.counts.defining).toBe(0);
    expect(model.edges.every((e) => e.defining === 0)).toBe(true);
    expect(model.findings.every((f) => f.tierLabel === TIER_LABELS.warning)).toBe(true);
  });

  it('variant A: the domain → infrastructure import is a highlighted defining edge with its excerpt', async () => {
    const model = buildArchitectModel(await reportInput('variant-a-structural'));
    expect(model.summary.verdict).toBe('fail');
    const edge = model.edges.find((e) => e.from === 'domain' && e.to === 'infrastructure');
    expect(edge).toMatchObject({ allowed: false });
    expect(edge?.defining).toBeGreaterThan(0);
    const f = model.findings.find((x) => x.ruleId === 'FF-S01' && x.file === 'src/domain/entities/Task.ts');
    expect(f?.tier).toBe('defining');
    expect(f?.path.map((p) => p.layer)).toEqual(['domain', 'infrastructure']);
    expect(f?.excerpt?.lines.find((l) => l.hit)?.text).toContain('InfraConfig');
    expect(f?.fixHint).not.toBe('');
    const cycle = model.findings.find((x) => x.pathKind === 'cycle');
    expect(cycle?.path[0]?.file).toBe(cycle?.path[cycle.path.length - 1]?.file);
  });

  it('variant B: the verdict explanation names what blocks it', async () => {
    const model = buildArchitectModel(await reportInput('variant-b-pattern'));
    expect(model.summary.verdict).toBe('fail');
    expect(model.summary.blockers.map((b) => b.title)).toContain('The domain is framework-free');
    expect(model.summary.explanation[0]).toMatch(/fails because 3 defining rules are broken/);
  });

  it('variant B: an imported package is an external step, not a layer', async () => {
    const model = buildArchitectModel(await reportInput('variant-b-pattern'));
    const f = model.findings.find((x) => x.path.some((p) => p.file === '@nestjs/common'));
    expect(f?.path.map((p) => [p.layer, p.external === true])).toEqual([['domain', false], [null, true]]);
    expect(f?.layers).toEqual(['domain']);
    expect(model.layers.map((l) => l.name)).toEqual(['domain', 'application', 'infrastructure']);
  });

  it('writes the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'architect-html-'));
    try {
      const out = writeArchitectReport(await reportInput('variant-a-structural'), join(dir, 'nested', 'r.html'));
      expect(readFileSync(out, 'utf-8')).toMatch(/^<!doctype html>/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a defining rule that could not run (EVAL_002) shows INCOMPLETE, not PASS', async () => {
    const input = await reportInput('correct-reference');
    const tiers = input.report.tiers;
    if (tiers === undefined) throw new Error('fixture without tiers');
    const report = { ...input.report, verdict: 'soft-block' as const, tiers: { ...tiers, verdict: 'incomplete' as const, blockingNotExecuted: [...tiers.blockingNotExecuted, 'FF-S02' as (typeof tiers.blockingNotExecuted)[number]] } };
    const model = buildArchitectModel({ ...input, report });
    expect(model.summary.verdict).toBe('incomplete');
    expect(model.summary.headline).toMatch(/^Incomplete/);
    expect(model.summary.explanation[0]).toMatch(/could not run/);
    expect(model.summary.notExecuted.map((r) => r.ruleId)).toContain('FF-S02');
    const html = architectReportHtml({ ...input, report });
    expect(html).toContain('class="summary verdict-incomplete"');
    expect(html).toContain('>INCOMPLETE</p>');
  });

  it('without tiers (v1.2e scoring) explains that the verdict comes from the score', async () => {
    const input = await reportInput('variant-a-structural');
    const { tiers: _drop, ...report } = input.report;
    const model = buildArchitectModel({ ...input, report });
    expect(model.summary.scoringMode).toBe('v1.2e');
    expect(model.summary.verdict).toBe('fail');
    expect(model.summary.explanation[0]).toMatch(/v1\.2e scoring/);
  });
});

describe('architect HTML report: helpers', () => {
  it('escapes HTML', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('reads only source files inside the project', () => {
    const root = join(REPO_ROOT, 'fixtures', 'variant-a-structural');
    expect(isReadableSource(root, 'src/domain/entities/Task.ts')).toBe(true);
    expect(isReadableSource(root, '../../package.json')).toBe(false);
    expect(isReadableSource(root, '../../src/cli/cli.ts')).toBe(false);
    expect(isReadableSource(root, '/etc/passwd')).toBe(false);
    expect(isReadableSource(root, '.env')).toBe(false);
    expect(isReadableSource(root, '.env.local.ts')).toBe(false);
    expect(isReadableSource(root, 'src/secrets.ts')).toBe(false);
    expect(isReadableSource(root, 'tsconfig.json')).toBe(false);
    expect(new SourceReader(root).excerpt('src/domain/entities/Task.ts', [999])).toBeNull();
    expect(new SourceReader(undefined).excerpt('src/domain/entities/Task.ts', [1])).toBeNull();
  });

  it('does not follow a symlink out of the project or onto a refused file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'excerpt-link-'));
    try {
      const root = join(tmp, 'project');
      mkdirSync(join(root, 'src'), { recursive: true });
      writeFileSync(join(root, 'src', 'ok.ts'), 'export const ok = 1;\n');
      writeFileSync(join(tmp, 'outside.ts'), 'export const PRIVATE_KEY = "outside the project";\n');
      writeFileSync(join(root, '.env'), 'TOKEN=abc\n');
      symlinkSync(join(tmp, 'outside.ts'), join(root, 'src', 'escape.ts'));
      symlinkSync(join(root, '.env'), join(root, 'src', 'env.ts'));
      symlinkSync(join(root, 'src', 'ok.ts'), join(root, 'src', 'alias.ts'));
      symlinkSync(tmp, join(root, 'src', 'up'));
      const reader = new SourceReader(root);
      // The name screen alone passes all four; the real path does not.
      expect(isReadableSource(root, 'src/escape.ts')).toBe(true);
      expect(realSourcePath(root, 'src/escape.ts')).toBeNull();
      expect(reader.excerpt('src/escape.ts', [1])).toBeNull();
      expect(reader.excerpt('src/env.ts', [1])).toBeNull();
      expect(reader.excerpt('src/up/outside.ts', [1])).toBeNull();
      // A link that stays inside the project onto an allowed source file is read.
      expect(reader.excerpt('src/alias.ts', [1])?.lines[0]?.text).toBe('export const ok = 1;');
      // A project root that is itself reached through a symlink still works.
      symlinkSync(root, join(tmp, 'root-link'));
      expect(new SourceReader(join(tmp, 'root-link')).excerpt('src/ok.ts', [1])?.lines[0]?.hit).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('marks the hit lines with context around them', () => {
    const ex = new SourceReader(join(REPO_ROOT, 'fixtures', 'variant-a-structural')).excerpt('src/domain/entities/Task.ts', [2]);
    expect(ex?.lines[0]?.n).toBe(1);
    expect(ex?.lines.filter((l) => l.hit).map((l) => l.n)).toEqual([2]);
  });

  it('falls back to the spec name for unknown rules and strips rule ids from text', () => {
    expect(plainRule('CUSTOM-1', 'no-direct-db', 'x')).toEqual({ title: 'No direct db', says: 'x' });
    expect(withoutRuleIds('Violation of FF-S01: domain imports infra')).toBe('Violation of domain imports infra');
  });
});
