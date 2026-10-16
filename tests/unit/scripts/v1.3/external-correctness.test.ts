import * as path from 'node:path';
import { controlItems, externalJobs, externalSample, groupRows, markdownTable, reportBlockingRules, row } from '../../../../scripts/v1.3/lib/external-correctness.js';
import type { ImportLister } from '../../../../scripts/v1.3/lib/external-correctness.js';
import type { Finding } from '../../../../scripts/v1.3/lib/labelling/findings.js';
import type { SampledFinding } from '../../../../scripts/v1.3/lib/labelling/sampler.js';

const finding = (over: Partial<Finding>): Finding => ({
  key: 'k', projectId: 'p', style: 'nestjs', ruleId: 'FF-S01', template: 'dependency-direction', type: 'LAYER_VIOLATION',
  tier: 'blocking', file: 'src/a.ts', line: 3, target: 'src/b.ts', discriminator: ['IMPORTS'], evidence: [], message: 'm', violationId: 'v1', ...over,
});
const sampled = (over: Partial<Finding>): SampledFinding => ({ ...finding(over), rule: `${over.ruleId ?? 'FF-S01'}/${over.template ?? 'dependency-direction'}`, inclusionProbability: 1 });

describe('external correctness: jobs', () => {
  it('builds one job per entry from the clone root, the spec and the report', () => {
    const j = externalJobs([{ id: 'zelda', style: 'nestjs', root: 'apps/api' }, { id: 'ddd-forum', style: 'ddd', root: '.' }], '/ext', '/clones');
    expect(j.jobs).toEqual([
      { projectId: 'zelda', projectRoot: path.resolve('/clones/zelda/apps/api'), spec: path.resolve('/ext/specs/zelda.yaml'), report: path.resolve('/ext/findings/zelda.json'), style: 'nestjs' },
      { projectId: 'ddd-forum', projectRoot: path.resolve('/clones/ddd-forum'), spec: path.resolve('/ext/specs/ddd-forum.yaml'), report: path.resolve('/ext/findings/ddd-forum.json'), style: 'ddd' },
    ]);
  });

  it('takes the blocking rules from the report tiers', () => {
    const r = { tiers: { blocking: { rules: [{ functionId: 'FF-S01', tier: 'blocking' }] }, advisory: { rules: [{ functionId: 'FF-C03', tier: 'advisory' }] } } };
    expect([...reportBlockingRules(r)]).toEqual(['FF-S01']);
  });
});

describe('external correctness: sample', () => {
  const blockingByProject = new Map([['p', new Set(['FF-S01'])]]);
  it('keeps every report-blocking finding and only the drawn advisory ones', () => {
    const fs = [finding({ key: 'a' }), finding({ key: 'b', ruleId: 'FF-C03', tier: 'advisory', violationId: 'v2' }), finding({ key: 'c', ruleId: 'FF-C03', tier: 'advisory', violationId: 'v3' })];
    const s = externalSample(fs, blockingByProject, new Set(['p\u0000v3']));
    expect(s.blocking.items.map((i) => i.key)).toEqual(['a']);
    expect(s.advisory.items.map((i) => i.key)).toEqual(['c']);
    expect(s.tierDisagreements).toEqual([]);
  });

  it('lists a tier disagreement and lets the report win', () => {
    const s = externalSample([finding({ key: 'a', tier: 'advisory' })], blockingByProject, new Set());
    expect(s.blocking.items).toHaveLength(1);
    expect(s.tierDisagreements).toEqual(['p FF-S01 report=blocking ruleTier=advisory']);
  });
});

describe('external correctness: summary rows', () => {
  it('computes precision over checkable findings with a Wilson interval and the not-checkable share', () => {
    const r = row('g', [{ verdict: 'correct' }, { verdict: 'correct' }, { verdict: 'incorrect' }, { verdict: 'not-checkable' }]);
    expect(r).toMatchObject({ n: 4, correct: 2, incorrect: 1, notCheckable: 1, notCheckableShare: 0.25 });
    expect(r.precision).toBeCloseTo(2 / 3);
    expect(r.wilsonLow).toBeGreaterThan(0);
    expect(r.wilsonHigh).toBeLessThan(1);
  });

  it('gives n/a precision when nothing is checkable, and groups in sorted order', () => {
    const rows = groupRows([{ verdict: 'not-checkable' as const, g: 'b' }, { verdict: 'correct' as const, g: 'a' }], (x) => x.g);
    expect(rows.map((x) => x.group)).toEqual(['a', 'b']);
    expect(rows[1]?.precision).toBeNull();
    expect(markdownTable('g', rows)).toContain('| b | 1 | 0 | 0 | 1 | n/a | n/a | 1.000 |');
  });
});

describe('external correctness: negative control', () => {
  const lister = (m: Record<string, { startLine: number; resolvedFile?: string; packageRoot?: string }[]>): ImportLister => ({ imports: (f) => m[f] ?? [] });

  it('moves an edge finding to another statement and its target to its own file', () => {
    const c = controlItems([sampled({})], () => lister({ 'src/a.ts': [{ startLine: 1, resolvedFile: 'src/c.ts' }, { startLine: 3, resolvedFile: 'src/b.ts' }] }));
    expect(c.items.map((i) => [i.kind, i.finding.line, i.finding.target])).toEqual([['target', 3, 'src/a.ts'], ['line', 1, 'src/b.ts']]);
    expect(c.skipped).toEqual([]);
  });

  it('skips the line perturbation when the only other statement reaches the same target or package', () => {
    const c = controlItems([sampled({ target: 'typeorm' })], () => lister({ 'src/a.ts': [{ startLine: 7, packageRoot: 'typeorm' }] }));
    expect(c.items.map((i) => i.kind)).toEqual(['target']);
    expect(c.skipped[0]).toContain('no other statement');
  });

  it('breaks a cycle with a project file the first file does not import', () => {
    // A cycle finding has no target or line; drop them rather than pass `undefined` (exactOptionalPropertyTypes).
    const { target: _t, line: _l, ...cyc } = sampled({ key: 'cy', ruleId: 'FF-S02', template: 'no-cyclic-deps', file: 'src/x.ts', discriminator: [JSON.stringify(['src/x.ts', 'src/y.ts', 'src/x.ts'])] });
    const other = sampled({ key: 'o', file: 'src/z.ts', target: 'src/w.ts' });
    const c = controlItems([cyc, other], () => lister({ 'src/x.ts': [{ startLine: 1, resolvedFile: 'src/y.ts' }, { startLine: 2, resolvedFile: 'src/w.ts' }] }));
    const item = c.items.find((i) => i.kind === 'cycle');
    expect(item?.finding.discriminator).toEqual([JSON.stringify(['src/x.ts', 'src/z.ts', 'src/x.ts'])]);
    expect(item?.finding.message).toBe('');
  });
});
