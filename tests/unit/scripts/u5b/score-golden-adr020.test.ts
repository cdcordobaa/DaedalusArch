/**
 * ADR-020 (P-2) scorer rules, on synthetic reports with hand-computed counts:
 * - item 2, MAT-10 1.1.0: FP-labelled = FP-strict minus every TP-class label (TP, unseeded-TP);
 * - item 5, MAT-19 1.1.0: neural new violations outside judge collateral go to `neuralNewByFunction`, never FP-strict;
 * - item 8: corpus-tier strata `corpus-core` / `corpus-e7` from the corpus tiers; `applicable` per instance.
 */
import { corpusTiers } from '../../../../scripts/lib/corpus.js';
import { baselineMatchKey, corpusTierStratum, scoreDifferential, strataOf } from '../../../../scripts/score-golden.js';
import type { GoldenScore, ReconciledP1Label, ScoreInput, ScoreOutcome } from '../../../../scripts/score-golden.js';
import { HELD_OUT, key, report, row, rule, seed } from './score-fixture.js';
import type { V } from './score-fixture.js';

const D = 'src/domain/Task.ts';
const I = 'src/infra/Repo.ts';
const IMP = ['IMPORTS'];
const S01_KEY = key('FF-S01', D, I, IMP, 'site-line', 3);
const S01_V: V = { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 };

function ok(o: ScoreOutcome): GoldenScore {
  if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
  return o.score;
}
const score = (input: Omit<ScoreInput, 'rule'>): GoldenScore => ok(scoreDifferential({ rule: rule(), ...input }));

describe('MAT-10 1.1.0: TP-class labels leave FP-labelled (ADR-020 item 2)', () => {
  it('4 FP-strict labelled {TP, unseeded-TP, FP, uncertain} → FP-labelled 2, fpUncertain 1, labelled precision 1/3', async () => {
    // Hand count: one detected seed (TP 1) and four undeclared new violations (FP-strict 4). TP and unseeded-TP both
    // leave FP-labelled, FP and uncertain stay: FP-labelled 2 → precision 1 / (1 + 2) = 0.333333; strict 1 / 5 = 0.2.
    const files = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
    const s = await report([S01_V, ...files.map((f) => ({ functionId: 'FF-C04', filePath: f }))]);
    const input = { seeds: [seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), await report([]), s)] };
    const first = scoreDifferential({ rule: rule(), ...input });
    if (!first.ok) throw new Error(first.detail);
    const byKey = new Map(first.labelItems.map((i) => [i.key, i.itemId]));
    const id = (f: string): string => byKey.get(baselineMatchKey({ functionId: 'FF-C04', filePath: f })) ?? '';
    const labels = new Map<string, ReconciledP1Label>([[id('src/a.ts'), 'TP'], [id('src/b.ts'), 'unseeded-TP'], [id('src/c.ts'), 'FP'], [id('src/d.ts'), 'uncertain']]);
    const overall = score({ ...input, labels }).overall.get(HELD_OUT);
    expect(overall?.strict).toMatchObject({ tp: 1, fp: 4, fn: 0 });
    expect(overall?.strict.precision).toBeCloseTo(0.2, 12);
    expect(overall?.labelled).toMatchObject({ tp: 1, fp: 2, fn: 0 });
    expect(overall?.labelled?.precision).toBeCloseTo(1 / 3, 12);
    expect(overall?.fpUncertain).toBe(1);
  });

  it('a twin FP labelled TP leaves the incl.-twins precision; one labelled FP stays', async () => {
    const pos = seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), await report([]), await report([S01_V]));
    const t1 = seed(row({ seedId: 'p:MO-S01n:0', expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } }), await report([]), await report([{ functionId: 'FF-C04', filePath: 'src/t1.ts' }]));
    const t2 = seed(row({ seedId: 'p:MO-S01n:1', expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } }), await report([]), await report([{ functionId: 'FF-C04', filePath: 'src/t2.ts' }]));
    const first = scoreDifferential({ rule: rule(), seeds: [pos, t1, t2] });
    if (!first.ok) throw new Error(first.detail);
    const ids = first.labelItems.map((i) => i.itemId);
    expect(ids).toHaveLength(2);
    // Hand count: TP 1; twin FP-strict 2, one labelled TP (leaves), one FP (stays) → incl. twins 1 / (1 + 1) = 0.5.
    const labels = new Map<string, ReconciledP1Label>([[ids[0] ?? '', 'TP'], [ids[1] ?? '', 'FP']]);
    const overall = score({ seeds: [pos, t1, t2], labels }).overall.get(HELD_OUT);
    expect(overall?.inclTwins?.precision).toBe(0.5);
    expect(overall?.labelled?.precision).toBe(1);
  });
});

describe('MAT-19 1.1.0: neural new violations in their own column (ADR-020 item 5)', () => {
  it('a neural new violation outside judge collateral is counted in neuralNewByFunction, not FP-strict nor a P1 item', async () => {
    const neural: V = { functionId: 'FF-N01', filePath: 'src/domain/Other.ts', unitId: 'u-other', route: 'neuronal' };
    const s = await report([S01_V, neural], { mode: 'full' });
    const out = scoreDifferential({ rule: rule(), seeds: [seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), await report([], { mode: 'full' }), s)] });
    if (!out.ok) throw new Error(out.detail);
    expect([...out.score.neuralNewByFunction]).toEqual([['FF-N01', 1]]);
    expect(out.score.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1 });
    expect(out.score.perFunction.get(HELD_OUT)?.has('FF-N01')).toBe(false);
    expect(out.labelItems).toEqual([]);
    expect(out.score.perInstance[0]?.undeclaredNew).toEqual([]);
  });

  it('a neural new violation on a twin leaves the twin clean', async () => {
    const neural: V = { functionId: 'FF-N01', filePath: 'src/domain/Other.ts', unitId: 'u-other', route: 'neuronal' };
    const t = seed(row({ seedId: 'p:MO-S01n:0', expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } }), await report([], { mode: 'full' }), await report([neural], { mode: 'full' }));
    const s = score({ seeds: [t] });
    expect(s.perInstance[0]?.status).toBe('twin-clean');
    expect(s.twinSpecificity).toEqual({ clean: 1, scored: 1 });
    expect([...s.neuralNewByFunction]).toEqual([['FF-N01', 1]]);
  });
});

describe('corpus-tier strata and applicable functions (ADR-020 items 3, 8)', () => {
  it('corpusTiers maps core entries to core and added entries to e7', () => {
    const tiers = corpusTiers({ entries: [{ name: 'realworld-test', core: true }, { name: 'added__x', core: false }] as never });
    expect([...tiers]).toEqual([['realworld-test', 'core'], ['added__x', 'e7']]);
  });

  it('a corpus seed with a known tier enters [held-out, corpus-<tier>, all]; fixture seeds and unknown projects do not', async () => {
    const tiers = new Map([['core1', 'core' as const], ['new1', 'e7' as const]]);
    const mk = async (seedId: string, baseKind: 'corpus' | 'fixture', detected: boolean) =>
      seed(row({ seedId, baseKind, expected: { functionIds: ['FF-S01', 'FF-S04'], keys: [S01_KEY] } }), await report([]), await report(detected ? [S01_V] : []));
    const s = score({
      seeds: [await mk('core1:MO-S01:0', 'corpus', true), await mk('new1:MO-S01:0', 'corpus', true), await mk('new1:MO-S01:1', 'corpus', false), await mk('fx:MO-S01:0', 'fixture', true), await mk('other:MO-S01:0', 'corpus', true)],
      corpusTiers: tiers,
    });
    const e7 = JSON.stringify(['held-out', corpusTierStratum('e7'), 'all']);
    const core = JSON.stringify(['held-out', 'corpus-core', 'all']);
    // Hand count: E7 = new1 copies 0 (TP) and 1 (FN) → recall 0.5; core = core1 (TP); all bases = 4 TP + 1 FN.
    expect(s.overall.get(e7)?.strict).toMatchObject({ tp: 1, fn: 1, recall: 0.5 });
    expect(s.overall.get(core)?.strict).toMatchObject({ tp: 1, fn: 0 });
    expect(s.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 4, fn: 1, recall: 0.8 });
    const byId = new Map(s.perInstance.map((i) => [i.seedId, i]));
    expect(byId.get('new1:MO-S01:1')?.corpusTier).toBe('e7');
    expect(byId.get('fx:MO-S01:0')?.corpusTier).toBeUndefined();
    expect(byId.get('other:MO-S01:0')?.corpusTier).toBeUndefined();
    expect(byId.get('core1:MO-S01:0')?.applicable).toEqual(['FF-S01', 'FF-S04']);
    expect(strataOf({ split: 'held-out', baseKind: 'corpus', coverage: 'in', corpusTier: 'e7' })).toContain(e7);
    expect(strataOf({ split: 'dev', baseKind: 'corpus', coverage: 'in' })).toHaveLength(3);
  });
});
