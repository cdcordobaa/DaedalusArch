/**
 * Hold-out scoring (Docs/v1.3/holdout-prespec.md §3–§5): Wilson intervals, the two pass checks, claim levels,
 * the deferred-rule exclusion, the negative control, near-misses, the normalisation views and graph agreement.
 * Synthetic references only; nothing here touches a sealed or hold-out file.
 */
import { wilson } from '../../../../scripts/lib/stats.js';
import {
  GRAPH_TARGET, RECALL_TARGET, checkTarget, claimLines, minPerfectN, proportion, renderHoldoutMarkdown, scoreGraph,
  scoreHoldout, scoresJson, strictMatch, weakestClaim,
} from '../../../../scripts/v1.3/lib/holdout-score.js';
import type { ActualFinding } from '../../../../scripts/v1.3/lib/compare.js';
import type { ExpectedFinding, LoadedReference, VariantKind } from '../../../../scripts/v1.3/lib/reference-model.js';

const ef = (ruleId: string, file: string, target?: string): ExpectedFinding => ({ ruleId, ruleName: ruleId.toLowerCase(), file, reason: 'planted', ...(target !== undefined && { target }) });
const af = (ruleId: string, file: string, target?: string): ActualFinding => ({ ruleId, file, ...(target !== undefined && { target }) });

function ref(style: string, variants: { id: string; kind: VariantKind; plants?: string; expected?: ExpectedFinding[] }[], extra: Partial<LoadedReference> = {}): LoadedReference {
  return {
    style: style as LoadedReference['style'], format: 'patch', dir: '/x', projectDir: '/x/project', specPath: '/x/spec.yaml',
    descriptor: {
      schemaVersion: 1, style: style as LoadedReference['style'], spec: 'spec.yaml', project: 'p', canonicalSource: 's', styleDefinition: [], authored: '2026-10-15',
      writtenBeforeToolRun: true, notApplicable: [], noViolatingVariant: [], outOfScope: '', variants: variants.map((v) => v.id),
      scopeRules: [
        { ruleId: 'FF-S01', ruleName: 'dependency-direction', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-S02', ruleName: 'no-cyclic-deps', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-DS01', ruleName: 'bounded-context-modules', severity: 'critical', blockingCandidate: true },
        { ruleId: 'FF-C03', ruleName: 'component-instability', severity: 'advisory', blockingCandidate: false },
      ],
    },
    graph: {
      schemaVersion: 1, style: style as LoadedReference['style'], variant: 'clean', note: '',
      files: [{ path: 'src/a.ts', layer: 'domain' }, { path: 'src/b.ts', layer: 'app' }, { path: 'src/c.ts', layer: 'infra' }],
      edges: [{ from: 'src/b.ts', to: 'src/a.ts', kind: 'import' }, { from: 'src/c.ts', to: 'src/b.ts', kind: 'import' }],
    },
    variants: variants.map((v) => ({
      manifest: { schemaVersion: 1, style: style as LoadedReference['style'], variant: v.id, kind: v.kind, plants: v.plants ?? null, description: '', patch: null, expectedFindings: v.expected ?? [] },
      patchPath: null,
    })),
    ...extra,
  };
}

describe('pass checks and claim levels', () => {
  it('needs n >= 35 for a perfect 0.90 lower bound, and >= 73 for 0.95 (prespec §5)', () => {
    expect(minPerfectN(0.9)).toBe(35);
    expect(wilson(34, 34).low).toBeLessThan(0.9);
    expect(minPerfectN(0.95)).toBe(73);
  });

  it('gives validated, validated at point estimate, characterised and no data', () => {
    expect(checkTarget('M1', proportion(40, 40), RECALL_TARGET).claim).toBe('validated');
    const small = checkTarget('M1', proportion(13, 13), RECALL_TARGET);
    expect(small).toMatchObject({ claim: 'validated at point estimate', pointPass: true, lowerBoundPass: false, lowerBoundReachable: false });
    expect(checkTarget('M1', proportion(50, 54), RECALL_TARGET)).toMatchObject({ claim: 'validated at point estimate', lowerBoundReachable: true });
    expect(checkTarget('M1', proportion(8, 10), RECALL_TARGET).claim).toBe('characterised');
    expect(checkTarget('M1', proportion(0, 0), RECALL_TARGET)).toMatchObject({ claim: 'no data', pointPass: null });
  });

  it('takes the weakest claim', () => {
    expect(weakestClaim(['validated', 'validated at point estimate'])).toBe('validated at point estimate');
    expect(weakestClaim(['validated', 'characterised', 'pending adjudication'])).toBe('pending adjudication');
    expect(weakestClaim([])).toBe('no data');
  });

  it('a proportion carries its Wilson interval', () => {
    const p = proportion(9, 10);
    expect(p.point).toBeCloseTo(0.9);
    expect(p.low).toBeCloseTo(wilson(9, 10).low);
    expect(p.high).toBeCloseTo(wilson(9, 10).high);
  });
});

describe('scoreHoldout', () => {
  const r = ref('layered', [
    { id: 'clean', kind: 'clean' },
    { id: 'v01-dir', kind: 'violation', plants: 'FF-S01', expected: [ef('FF-S01', 'src/a.ts', 'src/b.ts')] },
    { id: 'v02-cycle', kind: 'violation', plants: 'FF-S02', expected: [ef('FF-S02', 'src/a.ts', 'src/b.ts')] },
    { id: 'v03-missed', kind: 'violation', plants: 'FF-S01', expected: [ef('FF-S01', 'src/c.ts', 'src/a.ts')] },
    { id: 'v04-deferred', kind: 'violation', plants: 'FF-DS01', expected: [ef('FF-DS01', 'src/x.ts')] },
    { id: 'n01-quiet', kind: 'near-miss' },
    { id: 'n02-loud', kind: 'near-miss' },
  ]);
  const rows: Record<string, ActualFinding[]> = {
    clean: [af('FF-C03', 'src/b.ts'), af('FF-S01', 'src/b.ts', 'src/c.ts')],
    'v01-dir': [af('FF-S01', 'src/a.ts', 'src/b.ts'), af('FF-S01', 'src/b.ts', 'src/c.ts')],
    // The cycle path in the file column, as the template reports it.
    'v02-cycle': [af('FF-S02', 'src/a.ts,src/b.ts,src/a.ts', 'src/b.ts'), af('FF-S01', 'src/b.ts', 'src/c.ts')],
    'v03-missed': [af('FF-S01', 'src/b.ts', 'src/c.ts')],
    'v04-deferred': [af('FF-DS01', 'src/x.ts'), af('FF-S01', 'src/b.ts', 'src/c.ts')],
    'n01-quiet': [af('FF-S01', 'src/b.ts', 'src/c.ts')],
    'n02-loud': [af('FF-S01', 'src/b.ts', 'src/c.ts'), af('FF-S01', 'src/a.ts', 'src/c.ts')],
  };
  const graph = { files: [{ file: 'src/a.ts', layer: 'domain' }, { file: 'src/b.ts', layer: 'app' }, { file: 'src/c.ts', layer: 'app' }], edges: [{ from: 'src/b.ts', to: 'src/a.ts' }, { from: 'src/a.ts', to: 'src/c.ts' }] };
  const scores = scoreHoldout({
    refs: [r], actualOf: (_s, v) => rows[v] ?? [], deferredRules: ['FF-DS01'], toolGraphOf: () => graph,
    correctness: [
      { projectId: 'layered/v01-dir', ruleId: 'FF-S01', tier: 'blocking', file: 'src/a.ts', verdict: 'correct', reason: '' },
      { projectId: 'layered/v01-dir', ruleId: 'FF-S01', tier: 'blocking', file: 'src/b.ts', verdict: 'incorrect', reason: 'no such import' },
      { projectId: 'layered/v04-deferred', ruleId: 'FF-DS01', tier: 'blocking', file: 'src/x.ts', verdict: 'correct', reason: '' },
      { projectId: 'layered/n01-quiet', ruleId: 'FF-S01', tier: 'blocking', file: 'src/b.ts', verdict: 'not-checkable', reason: 'n/a' },
      { projectId: 'nestjs/v01', ruleId: 'FF-S01', tier: 'blocking', file: 'src/z.ts', verdict: 'incorrect', reason: 'other style' },
    ],
  });
  const s = scores.styles[0];
  if (s === undefined) throw new Error('no style');

  it('M1 and M2 use compare.ts matching (the cycle by its file set) and leave the deferred rule out', () => {
    // TP: v01 FF-S01, v02 FF-S02 (set match). FN: v03. FP: the baseline row on every variant (7) and the near-miss row.
    expect(s.blocking).toMatchObject({ tp: 2, fn: 1, fp: 8 });
    expect(s.blocking.recall.point).toBeCloseTo(2 / 3);
    expect(s.blocking.precision.point).toBeCloseTo(2 / 10);
    // Distinct: the baseline row counts once, on the clean variant.
    expect(s.blocking.fpDistinct).toBe(2);
    expect(s.deferred).toMatchObject({ tp: 1, fn: 0, fp: 0 });
    expect(s.rules.find((x) => x.ruleId === 'FF-DS01')?.tier).toBe('deferred');
    expect(s.misses.map((m) => m.variant)).toEqual(['v03-missed']);
  });

  it('the strict-key view does not read the cycle path as a file set', () => {
    expect(s.blockingStrictKey.tp).toBe(1);
    expect(s.blockingStrictKey.fn).toBe(2);
  });

  it('M3 counts the checkable blocking findings of the style, not the deferred ones', () => {
    expect(s.correct?.value).toMatchObject({ k: 1, n: 2 });
    expect(s.correct?.incorrect).toEqual([{ variant: 'v01-dir', ruleId: 'FF-S01', file: 'src/b.ts', reason: 'no such import' }]);
    expect(s.correct?.notCheckable).toHaveLength(1);
  });

  it('M4 keeps the advisory rule apart, M5 and M6 count false alarms', () => {
    expect(s.advisory).toMatchObject({ tp: 0, fp: 1 });
    expect(s.negativeControl).toMatchObject({ cleanVariants: 1, withFalseAlarm: 1 });
    expect(s.negativeControl.falseAlarms.map((f) => f.ruleId)).toEqual(['FF-S01']);
    expect(s.nearMiss.value).toMatchObject({ k: 2, n: 2 });
    expect(s.nearMiss.falseAlarms.filter((f) => f.alsoOnClean !== true).map((f) => f.variant)).toEqual(['n02-loud']);
    expect(s.plantedDetected).toMatchObject({ k: 3, n: 4 });
  });

  it('M7 is literal first and pending until every disagreement is adjudicated', () => {
    const g = s.graph;
    expect(g?.literal.edgeRecall).toMatchObject({ k: 1, n: 2 });
    expect(g?.literal.edgePrecision).toMatchObject({ k: 1, n: 2 });
    expect(g?.literal.layerAccuracy).toMatchObject({ k: 2, n: 3 });
    expect(g?.adjudicated.pending).toBe(3);
    expect(s.checks.filter((c) => c.metric.startsWith('M7')).every((c) => c.claim === 'pending adjudication')).toBe(true);
    expect(s.claim).toBe('pending adjudication');
  });

  it('adjudication moves disagreements to the side judged right', () => {
    const g = scoreGraph(r, graph, { edges: { 'src/a.ts -> src/c.ts': 'tool', 'src/c.ts -> src/b.ts': 'reference' }, layers: { 'src/c.ts': 'tool' } });
    expect(g.adjudicated.pending).toBe(0);
    expect(g.adjudicated.edgeRecall).toMatchObject({ k: 2, n: 3 });
    expect(g.adjudicated.edgePrecision).toMatchObject({ k: 2, n: 2 });
    expect(g.adjudicated.layerAccuracy).toMatchObject({ k: 3, n: 3 });
  });

  it('the overlay format scores key-edge recall only', () => {
    const o = scoreGraph({ ...r, format: 'overlay' }, graph, undefined);
    expect(o.kind).toBe('key edges only');
    expect(o.literal.edgePrecision).toBeNull();
    expect(o.onlyTool).toEqual([]);
  });

  it('pools M2 and M3 over styles and renders every section', () => {
    expect(scores.pooled.blocking.tp).toBe(2);
    expect(scores.pooled.checks.map((c) => c.metric)).toEqual(['M2 blocking precision (manifest)', 'M3 blocking precision (correct)']);
    const md = renderHoldoutMarkdown(scores, '# test');
    for (const h of ['Claim levels', 'M3 blocking precision', 'M4 advisory', 'M5 negative control', 'M7 graph agreement', 'Every blocking miss']) expect(md).toContain(h);
    expect(md).toContain('FF-DS01');
    expect(claimLines(scores)[0]).toMatch(/^layered: pending adjudication \(M1 blocking recall: characterised; /);
    const json = scoresJson(scores) as { styles: { comparisons: unknown[] }[] };
    expect(json.styles[0]?.comparisons.length).toBeGreaterThan(0);
  });

  it('a perfect small style is validated at the point estimate only', () => {
    const p = ref('nestjs', [{ id: 'clean', kind: 'clean' }, { id: 'v01', kind: 'violation', plants: 'FF-S01', expected: [ef('FF-S01', 'src/a.ts', 'src/b.ts')] }]);
    const sc = scoreHoldout({ refs: [p], actualOf: (_s, v) => (v === 'v01' ? [af('FF-S01', 'src/a.ts', 'src/b.ts')] : []) });
    expect(sc.styles[0]?.claim).toBe('validated at point estimate');
    expect(sc.styles[0]?.checks.map((c) => c.metric)).toEqual(['M1 blocking recall', 'M2 blocking precision (manifest)']);
    expect(GRAPH_TARGET).toBe(0.95);
  });
});

describe('strictMatch', () => {
  it('pairs exact targets first, then target-less rows', () => {
    const m = strictMatch([ef('FF-S01', 'a', 't1'), ef('FF-S01', 'a')], [af('FF-S01', 'a'), af('FF-S01', 'a', 't1')]);
    expect(m.tp).toBe(2);
    expect(m.fpIdx).toEqual([]);
  });
});
