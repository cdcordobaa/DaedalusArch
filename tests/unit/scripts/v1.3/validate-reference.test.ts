/**
 * FR-V5 skeleton: finding comparison, metrics and the runner's modes. Neo4j is not available to unit tests, so the
 * live mode runs with an injected evaluator; the real CLI evaluator is exercised only by a local live run.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compareVariant, normaliseFindingPath, renderMarkdown, styleMetrics } from '../../../../scripts/v1.3/lib/compare.js';
import type { ActualFinding } from '../../../../scripts/v1.3/lib/compare.js';
import { LIVE_REFUSAL, main, parseArgs } from '../../../../scripts/v1.3/lib/validate-reference-main.js';
import type { Evaluator } from '../../../../scripts/v1.3/lib/validate-reference-main.js';
import { loadAllReferences } from '../../../../scripts/v1.3/lib/reference-model.js';
import type { ExpectedFinding } from '../../../../scripts/v1.3/lib/reference-model.js';

const ROOT = path.resolve(__dirname, '../../../..');
function must<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

const SCOPE = new Set(['FF-S01', 'FF-S04', 'FF-P02']);

const exp = (ruleId: string, file: string, target?: string): ExpectedFinding => ({
  ruleId, ruleName: ruleId.toLowerCase(), file, reason: 'planted for the test', ...(target !== undefined ? { target } : {}),
});
const act = (ruleId: string, file: string, target?: string): ActualFinding => ({ ruleId, file, ...(target !== undefined ? { target } : {}) });

describe('compareVariant', () => {
  const manifest = {
    variant: 'v01-x', kind: 'violation' as const, plants: 'FF-S01',
    expectedFindings: [exp('FF-S01', 'src/d.ts', 'src/i.ts'), exp('FF-S04', 'src/d.ts', 'src/i.ts')],
  };

  it('matches on rule, file and target, and reports nothing else', () => {
    const c = compareVariant('s', manifest, [act('FF-S01', 'src/d.ts', 'src/i.ts'), act('FF-S04', 'src/d.ts', 'src/i.ts')], SCOPE);
    expect(c.matched).toHaveLength(2);
    expect(c.mismatches).toEqual([]);
    expect(c.plantedDetected).toBe(true);
  });

  it('reports a missed finding with its manifest reason and an unexpected one', () => {
    const c = compareVariant('s', manifest, [act('FF-S01', 'src/d.ts', 'src/i.ts'), act('FF-P02', 'src/u.ts')], SCOPE);
    expect(c.mismatches).toEqual([
      { kind: 'missed', ruleId: 'FF-S04', file: 'src/d.ts', target: 'src/i.ts', reason: 'planted for the test' },
      { kind: 'unexpected', ruleId: 'FF-P02', file: 'src/u.ts' },
    ]);
  });

  it('does not match a different target, but ignores a target the tool does not report', () => {
    expect(compareVariant('s', manifest, [act('FF-S01', 'src/d.ts', 'src/other.ts')], SCOPE).plantedDetected).toBe(false);
    expect(compareVariant('s', manifest, [act('FF-S01', 'src/d.ts')], SCOPE).plantedDetected).toBe(true);
  });

  it('is one-to-one and prefers exact-target rows whatever their order', () => {
    const m = { ...manifest, expectedFindings: [exp('FF-S01', 'src/d.ts'), exp('FF-S01', 'src/d.ts', 'src/i.ts')] };
    const c = compareVariant('s', m, [act('FF-S01', 'src/d.ts', 'src/i.ts'), act('FF-S01', 'src/d.ts', 'src/j.ts'), act('FF-S01', 'src/d.ts', 'src/k.ts')], SCOPE);
    expect(c.matched).toHaveLength(2);
    expect(c.mismatches).toEqual([{ kind: 'unexpected', ruleId: 'FF-S01', file: 'src/d.ts', target: 'src/k.ts' }]);
  });

  it('lists rows of rules outside the scope as unscored and marks baseline rows seen on the clean variant', () => {
    const clean = [act('FF-P02', 'src/u.ts')];
    const c = compareVariant('s', manifest, [...manifest.expectedFindings.map((e) => act(e.ruleId, e.file, e.target)), act('FF-P02', 'src/u.ts'), act('FF-C02', 'src/main.ts')], SCOPE, clean);
    expect(c.unscored).toEqual([act('FF-C02', 'src/main.ts')]);
    expect(c.mismatches).toEqual([{ kind: 'unexpected', ruleId: 'FF-P02', file: 'src/u.ts', alsoOnClean: true }]);
  });

  it('normalises absolute and ./ paths', () => {
    expect(normaliseFindingPath('/tmp/x/proj/src/a.ts', '/tmp/x/proj')).toBe('src/a.ts');
    expect(normaliseFindingPath('./src/a.ts')).toBe('src/a.ts');
    expect(normaliseFindingPath('typeorm', '/tmp/x/proj')).toBe('typeorm');
  });
});

describe('cycle findings match on the set of files (v1.3 fix round, fix 2)', () => {
  const scope = new Set(['FF-S01', 'FF-S02']);
  const cycle = {
    variant: 'v01-cycle', kind: 'violation' as const, plants: 'FF-S02',
    expectedFindings: [exp('FF-S02', 'src/domain/Loan.ts', 'src/domain/Member.ts')],
  };

  it('the tool row (cycle path in file, second file in target) matches the manifest row (smallest file, next file)', () => {
    const c = compareVariant('s', cycle, [act('FF-S02', 'src/domain/Loan.ts,src/domain/Member.ts,src/domain/Loan.ts', 'src/domain/Member.ts')], scope);
    expect(c.matched).toHaveLength(1);
    expect(c.mismatches).toEqual([]);
    expect(c.plantedDetected).toBe(true);
  });

  it('the set decides, not the rotation or the order of the files', () => {
    const c = compareVariant('s', cycle, [act('FF-S02', 'src/domain/Member.ts,src/domain/Loan.ts,src/domain/Member.ts')], scope);
    expect(c.matched).toHaveLength(1);
  });

  it('a different set is a miss plus an unexpected row; a superset is not the same cycle', () => {
    const c = compareVariant('s', cycle, [act('FF-S02', 'src/domain/Loan.ts,src/domain/Member.ts,src/domain/Fine.ts,src/domain/Loan.ts', 'src/domain/Member.ts')], scope);
    expect(c.mismatches.map((m) => m.kind).sort()).toEqual(['missed', 'unexpected']);
    // the unexpected row keeps the tool's own file text
    expect(c.mismatches.find((m) => m.kind === 'unexpected')?.file).toBe('src/domain/Loan.ts,src/domain/Member.ts,src/domain/Fine.ts,src/domain/Loan.ts');
  });

  it('a cycle row on the clean variant counts as alsoOnClean under the set key', () => {
    const nm = { variant: 'n01', kind: 'near-miss' as const, plants: null, expectedFindings: [] };
    const c = compareVariant('s', nm, [act('FF-S02', 'src/b.ts,src/a.ts,src/b.ts')], scope, [act('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', 'src/b.ts')]);
    expect(c.mismatches).toEqual([expect.objectContaining({ kind: 'unexpected', alsoOnClean: true })]);
  });

  it('other rules still need the same file', () => {
    const m = { variant: 'v02', kind: 'violation' as const, plants: 'FF-S01', expectedFindings: [exp('FF-S01', 'src/a.ts', 'src/b.ts')] };
    expect(compareVariant('s', m, [act('FF-S01', 'src/b.ts', 'src/a.ts')], scope).matched).toHaveLength(0);
  });
});

describe('styleMetrics', () => {
  const descriptor = {
    scopeRules: [
      { ruleId: 'FF-S01', ruleName: 'dependency-direction', severity: 'critical' as const, blockingCandidate: true },
      { ruleId: 'FF-S04', ruleName: 'no-domain-outward-dep', severity: 'major' as const, blockingCandidate: false },
    ],
  };
  it('computes recall, precision and the distinct-FP precision per rule and pooled', () => {
    const scope = new Set(['FF-S01', 'FF-S04']);
    const clean = compareVariant('s', { variant: 'clean', kind: 'clean', plants: null, expectedFindings: [] }, [act('FF-S01', 'src/fp.ts', 'src/z.ts')], scope);
    const v1 = compareVariant(
      's',
      { variant: 'v01-a', kind: 'violation', plants: 'FF-S01', expectedFindings: [exp('FF-S01', 'src/a.ts', 'src/b.ts'), exp('FF-S04', 'src/a.ts')] },
      [act('FF-S01', 'src/a.ts', 'src/b.ts'), act('FF-S01', 'src/fp.ts', 'src/z.ts')],
      scope,
      [act('FF-S01', 'src/fp.ts', 'src/z.ts')],
    );
    const nm = compareVariant('s', { variant: 'n01-a', kind: 'near-miss', plants: null, expectedFindings: [] }, [], scope, [act('FF-S01', 'src/fp.ts', 'src/z.ts')]);
    const m = styleMetrics({ style: 's', descriptor }, [clean, v1, nm]);
    const s01 = must(m.rules.find((r) => r.ruleId === 'FF-S01'));
    expect(s01).toMatchObject({ tp: 1, fn: 0, fp: 2, fpDistinct: 1, recall: 1, precision: 1 / 3, precisionDistinct: 0.5 });
    expect(m.rules.find((r) => r.ruleId === 'FF-S04')).toMatchObject({ tp: 0, fn: 1, recall: 0, precision: null });
    expect(m.blocking).toMatchObject({ tp: 1, fn: 0, fp: 2 });
    expect(m.all).toMatchObject({ tp: 1, fn: 1, recall: 0.5 });
    expect(m).toMatchObject({ plantedDetected: 1, violationVariants: 1, silentNonViolations: 1, nonViolationVariants: 2 });
    const md = renderMarkdown([m], [clean, v1, nm], '# t');
    expect(md).toContain('| s | 3 | 1/1 | 1/2 |');
    expect(md).toContain('| v01-a | violation | missed | FF-S04 | src/a.ts |');
    expect(md).toContain('also on the clean variant');
  });
});

describe('validate-reference main', () => {
  const io = (): { out: string[]; err: string[]; deps: { env: NodeJS.ProcessEnv; out: (t: string) => void; err: (t: string) => void } } => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, deps: { env: {}, out: (t) => out.push(t), err: (t) => err.push(t) } };
  };

  it('parses its arguments and refuses bad ones', () => {
    expect(parseArgs(['--check', '--style', 'nestjs,layered'])).toEqual({ mode: 'check', styles: ['nestjs', 'layered'], out: 'results/v1.3-reference' });
    expect(parseArgs(['--style', 'ddd'])).toMatchObject({ styles: ['ddd'] });
    expect(parseArgs(['--style', 'onion'])).toMatch(/--style/);
    expect(parseArgs(['--check', '--from-raw', 'x'])).toMatch(/choose one/);
    expect(parseArgs(['--bogus'])).toMatch(/unexpected argument/);
  });

  it('--check validates every manifest, applies every patch and overlay, and every variant compiles (all five styles)', async () => {
    const { out, err, deps } = io();
    expect(await main(['--check'], ROOT, deps)).toBe(0);
    expect(err).toEqual([]);
    const refs = loadAllReferences(ROOT);
    expect(refs.map((r) => r.style)).toEqual(['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd']);
    // One line per variant, then one summary line per style.
    expect(out.length).toBe(refs.reduce((n, r) => n + r.variants.length + 1, 0));
    expect(out.filter((l) => / variants \((patch|overlay) format\)/.test(l)).every((l) => l.includes(': ok,'))).toBe(true);
    expect(out.filter((l) => !/ variants \(/.test(l)).every((l) => l.endsWith(', compiles\n'))).toBe(true);
    expect(out.join('')).toContain('ddd: ok, 15 variants (overlay format); blocking (v1.3 tiers): FF-DS01, FF-DS02, FF-DT01, FF-DT02, FF-DT03, FF-DT04, FF-S01');
    expect(out.join('')).toContain('hexagonal: ok, 15 variants (patch format); blocking (v1.3 tiers): FF-S01, FF-S02, FF-S04, FF-P01, FF-P03, FF-P06');
  }, 300_000);

  it('refuses the live run without Neo4j settings', async () => {
    const { err, deps } = io();
    expect(await main(['--style', 'layered'], ROOT, deps)).toBe(2);
    expect(err.join('')).toContain(LIVE_REFUSAL);
  });

  it('a perfect evaluator scores 1.0 everywhere; a silent one scores recall 0; raw outputs replay identically', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-runner-'));
    try {
      const refs = loadAllReferences(ROOT, ['hexagonal']);
      // A stand-in for the tool that returns exactly the manifest of the variant it is shown (found by its patch).
      const oracle: Evaluator = (projectDir) => {
        const variant = path.basename(projectDir);
        const manifest = must(must(refs[0]).variants.find((v) => v.manifest.variant === variant)).manifest;
        return Promise.resolve(manifest.expectedFindings.map((f) => act(f.ruleId, f.file, f.target)));
      };
      const perfect = io();
      expect(await main(['--style', 'hexagonal', '--out', outDir], ROOT, { ...perfect.deps, evaluate: oracle })).toBe(0);
      const report = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8')) as { metrics: { blocking: { recall: number; precision: number }; plantedDetected: number; violationVariants: number }[] };
      expect(must(report.metrics[0]).blocking).toMatchObject({ recall: 1, precision: 1 });
      expect(must(report.metrics[0]).plantedDetected).toBe(must(report.metrics[0]).violationVariants);

      const replay = io();
      const replayOut = path.join(outDir, 'replay');
      expect(await main(['--style', 'hexagonal', '--from-raw', path.join(outDir, 'raw'), '--out', replayOut], ROOT, replay.deps)).toBe(0);
      expect(fs.readFileSync(path.join(replayOut, 'report.json'), 'utf8')).toContain('"recall": 1');

      const silent = io();
      const silentOut = path.join(outDir, 'silent');
      expect(await main(['--style', 'hexagonal', '--out', silentOut], ROOT, { ...silent.deps, evaluate: () => Promise.resolve([]) })).toBe(0);
      const md = fs.readFileSync(path.join(silentOut, 'report.md'), 'utf8');
      expect(md).toContain('| hexagonal | 15 | 0/11 | 4/4 | 0.00 | n/a |');
      expect(md).toContain('| v10-domain-service-holds-adapter | violation | missed | FF-P06 |');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
