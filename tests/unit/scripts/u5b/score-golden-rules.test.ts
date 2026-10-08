/**
 * U5b Step 9: matching-rule order and edge cases (BR-U5b-12..19; exit criterion 6), on synthetic reports.
 */
import { SCORE_INPUT_REJECTED, baselineMatchKey, crossesThreshold, scoreDifferential, sccMembers } from '../../../../scripts/score-golden.js';
import type { GoldenScore, ReconciledP1Label, ScoreInput, ScoreOutcome } from '../../../../scripts/score-golden.js';
import { FNS, HELD_OUT, SPEC_SHA, key, report, row, rule, seed } from './score-fixture.js';
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

function score(input: Omit<ScoreInput, 'rule'>): GoldenScore {
  return ok(scoreDifferential({ rule: rule(), ...input }));
}

describe('rule order and statuses (BR-U5b-12)', () => {
  it('one row per status; a row both not-applicable and site-invalid is not-applicable; rejections are never instances', async () => {
    const empty = await report([]);
    const withSeedKey = await report([S01_V]);
    const twinRow = (id: string) => row({ seedId: `p:${id}:0`, expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } });
    const seeds = [
      seed(row({ seedId: 'p:MO-A:0', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), empty, withSeedKey),
      seed(row({ seedId: 'p:MO-B:0', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), empty, empty),
      seed(row({ seedId: 'p:MO-C:0', expected: { functionIds: [], disabledFunctionIds: [{ functionId: 'FF-S03', reason: 'style' }] } }), empty, empty),
      seed(row({ seedId: 'p:MO-D:0', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), withSeedKey, withSeedKey),
      seed(twinRow('MO-E'), empty, empty),
      seed(twinRow('MO-F'), empty, await report([{ functionId: 'FF-C04', filePath: 'src/x.ts' }])),
      // Both not-applicable (FF-S01 disabled in the seeded report) and site-invalid (its key in the baseline).
      seed(row({ seedId: 'p:MO-G:0', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), withSeedKey, await (async () => {
        const r = await report([S01_V], { fns: FNS.filter((f) => f.functionId !== 'FF-S01') });
        r.disabledFunctions = [{ functionId: 'FF-S01', name: 'dependency-direction', reason: 'disabled' }];
        return r;
      })()),
    ];
    const rejections = [{ operatorId: 'MO-Z', projectId: 'p', reason: 'no-site' as const, detail: 'none', appliedAt: '2026-10-08T00:00:00.000Z' }];
    const s = score({ seeds, rejections });
    expect(s.perInstance.map((i) => [i.operatorId, i.status])).toEqual([
      ['MO-A', 'matched'], ['MO-B', 'missed'], ['MO-C', 'not-applicable'], ['MO-D', 'site-invalid'],
      ['MO-E', 'twin-clean'], ['MO-F', 'twin-fired'], ['MO-G', 'not-applicable'],
    ]);
    expect(s.perInstance.some((i) => i.operatorId === 'MO-Z')).toBe(false);
  });
});

describe('not-applicable (BR-U5b-13)', () => {
  it('a seed expecting FF-S03 on a style-disabled spec is not-applicable, counted, no FN', async () => {
    const r = row({ expected: { functionIds: [], disabledFunctionIds: [{ functionId: 'FF-S03', reason: 'not applicable to style clean-architecture' }] } });
    const s = score({ seeds: [seed(r, await report([]), await report([]))] });
    expect(s.perInstance[0]?.status).toBe('not-applicable');
    expect(s.notApplicable.get('FF-S03')).toBe(1);
    expect(s.overall.get(HELD_OUT)).toBeUndefined();
  });

  it('a function skipped by mode (no functionResults row) is not applicable; an absent template too', async () => {
    const skipped = await report([], { fns: FNS.filter((f) => f.functionId !== 'FF-S01') });
    const s = score({ seeds: [seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), skipped, skipped)] });
    expect(s.perInstance[0]?.status).toBe('not-applicable');
    expect(s.notApplicable.get('FF-S01')).toBe(1);
    const absent = score({ seeds: [seed(row({ expected: { functionIds: [], absentTemplates: ['domain-state-purity'] } }), await report([]), await report([]))] });
    expect(absent.perInstance[0]?.status).toBe('not-applicable');
    expect(absent.notApplicable.get('domain-state-purity')).toBe(1);
  });

  it('one of two expected functions not applicable: dropped from the per-function rows, the seed still scored', async () => {
    const seeded = await report([S01_V], { fns: FNS.filter((f) => f.functionId !== 'FF-S04') });
    const r = row({ expected: { functionIds: ['FF-S01', 'FF-S04'], keys: [S01_KEY, key('FF-S04', D, I, IMP, 'site-line', 3)] } });
    const s = score({ seeds: [seed(r, await report([], { fns: FNS.filter((f) => f.functionId !== 'FF-S04') }), seeded)] });
    expect(s.perInstance[0]?.status).toBe('matched');
    expect(s.perFunction.get(HELD_OUT)?.has('FF-S04')).toBe(false);
    expect(s.notApplicable.get('FF-S04')).toBe(1);
  });

  it('a report with the function in functionExecution.failed is rejected before this rule', async () => {
    const seeded = await report([]);
    seeded.functionExecution.failed = [{ functionId: 'FF-S01', name: 'dependency-direction', code: 'EVAL_001', message: 'x' }];
    const o = scoreDifferential({ rule: rule(), seeds: [seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), await report([]), seeded)] });
    expect(o.ok ? 'scored' : o.code).toBe(SCORE_INPUT_REJECTED);
  });
});

describe('site-invalid (BR-U5b-14)', () => {
  it('a baseline already holding the seed key → site-invalid, counted, not FN', async () => {
    const b = await report([S01_V]);
    const s = score({ seeds: [seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), b, await report([S01_V]))] });
    expect(s.perInstance[0]?.status).toBe('site-invalid');
    expect(s.siteInvalid).toBe(1);
    expect(s.overall.get(HELD_OUT)).toBeUndefined();
  });
});

describe('metric threshold crossing (BR-U5b-15)', () => {
  const metricRow = () => row({ seedId: 'p:MO-C02:0', expected: { functionIds: ['FF-C05'], dimension: 'coupling', keys: [key('FF-C05', D)] } });
  const thresholds = new Map([[SPEC_SHA, { 'module-fan-out': 8 }]]);

  it('fanOut 7 → 9 with threshold 8 is a detection (counted); 9 → 10 is not', async () => {
    const up = score({
      seeds: [seed(metricRow(), await report([{ functionId: 'FF-C05', filePath: D, evidence: ['fanOut=7'] }]), await report([{ functionId: 'FF-C05', filePath: D, evidence: ['fanOut=9'] }]))],
      thresholds,
    });
    expect(up.perInstance[0]?.status).toBe('matched');
    expect(up.metricCrossings).toBe(1);
    const already = score({
      seeds: [seed(metricRow(), await report([{ functionId: 'FF-C05', filePath: D, evidence: ['fanOut=9'] }]), await report([{ functionId: 'FF-C05', filePath: D, evidence: ['fanOut=10'] }]))],
      thresholds,
    });
    expect(already.perInstance[0]?.status).toBe('missed');
    expect(already.metricCrossings).toBe(0);
  });

  it('crossesThreshold works in both comparison directions and ignores non-numeric columns', () => {
    expect(crossesThreshold(['ratio=0.4'], ['ratio=0.2'], 0.3)).toBe(true);
    expect(crossesThreshold(['ratio=0.2'], ['ratio=0.1'], 0.3)).toBe(false);
    expect(crossesThreshold(['name=a'], ['name=b'], 0.3)).toBe(false);
  });
});

describe('metric-key exclusions (BR-U5b-16; exit criterion 6)', () => {
  const pr = { functionId: 'FF-C06', filePath: '<project>' };

  it('a seeded report that changes only the abstraction ratio produces no new key', async () => {
    const r = row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const s = score({ seeds: [seed(r, await report([{ ...pr, evidence: ['ratio=0.2'] }]), await report([S01_V, { ...pr, evidence: ['ratio=0.25'] }]))] });
    expect(s.perInstance[0]?.undeclaredNew).toEqual([]);
    expect(s.overall.get(HELD_OUT)?.strict.fp).toBe(0);
    expect(s.metricKeyExclusions.size).toBe(0);
  });

  it('with the export marking the flags absent, an FF-C06 new violation lands in metricKeyExclusions, not FP', async () => {
    const r = row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const seeds = [seed(r, await report([]), await report([S01_V, { ...pr, evidence: ['ratio=0.2'] }]))];
    const absent = score({ seeds, metricKeyReadiness: { projectLevelKeys: true, rowFilters: false } });
    expect(absent.metricKeyExclusions.get('FF-C06')).toBe(1);
    expect(absent.overall.get(HELD_OUT)?.strict.fp).toBe(0);
    const ready = score({ seeds, metricKeyReadiness: { projectLevelKeys: true, rowFilters: true } });
    expect(ready.metricKeyExclusions.size).toBe(0);
    expect(ready.overall.get(HELD_OUT)?.strict.fp).toBe(1);
  });
});

describe('twins and specificity (BR-U5b-17)', () => {
  it('a twin with one undeclared new violation → twin-fired, specificity 0/1, headline precision unchanged, incl. twins lower', async () => {
    const pos = seed(row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), await report([]), await report([S01_V]));
    const twin = seed(
      row({ seedId: 'p:MO-S01n:0', expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [] } }),
      await report([]),
      await report([{ functionId: 'FF-S01', filePath: I, target: D, discriminator: IMP }]),
    );
    const first = scoreDifferential({ rule: rule(), seeds: [pos, twin] });
    if (!first.ok) throw new Error(first.detail);
    expect(first.score.perInstance.map((i) => i.status)).toEqual(['matched', 'twin-fired']);
    expect(first.score.twinSpecificity).toEqual({ clean: 0, scored: 1 });
    expect(first.score.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fp: 0, precision: 1 });
    expect(first.labelItems.map((i) => i.twin)).toEqual([true]);
    const labels = new Map<string, ReconciledP1Label>(first.labelItems.map((i) => [i.itemId, 'FP']));
    const labelled = ok(scoreDifferential({ rule: rule(), seeds: [pos, twin], labels }));
    expect(labelled.overall.get(HELD_OUT)?.labelled?.precision).toBe(1);
    expect(labelled.overall.get(HELD_OUT)?.inclTwins?.precision).toBe(0.5);
  });

  it("a twin's declared collateral is neutral → twin-clean", async () => {
    const coll = { kind: 'site', template: 'test-file-pairing', functionId: 'FF-CV05', cause: 'created-without-test', key: key('FF-CV05', 'src/new.ts') };
    const twin = seed(
      row({ seedId: 'p:MO-C04n:0', expected: { negative: true, twinOf: 'MO-C04', functionIds: [], keys: [], collateral: [coll] } }),
      await report([]),
      await report([{ functionId: 'FF-CV05', filePath: 'src/new.ts' }]),
    );
    const s = score({ seeds: [twin] });
    expect(s.perInstance[0]?.status).toBe('twin-clean');
    expect(s.twinSpecificity).toEqual({ clean: 1, scored: 1 });
    expect(s.collateralByFunction.get('FF-CV05')).toBe(1);
  });
});

describe('SCC mode (BR-U5b-18)', () => {
  const scc = (members: readonly string[]): V => ({
    functionId: 'FF-S02', filePath: [...members].sort()[0] ?? '', discriminator: ['scc'], evidence: [`cycle=${JSON.stringify(members)}`],
  });

  it('sccMembers reads the cycle evidence of ["scc"] rows only', () => {
    expect(sccMembers({ discriminator: ['scc'], evidence: ['cycle=["a","c"]'] })).toEqual(['a', 'c']);
    expect(sccMembers({ discriminator: ['IMPORTS'], evidence: [] })).toBeUndefined();
  });

  it('baseline {a,c}, seeded {a,b,c} → pre-existing; seeded {0,a,c} (smallest member changed) → matched by overlap, counted', async () => {
    const r = row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const same = score({ seeds: [seed(r, await report([scc(['a', 'c'])]), await report([S01_V, scc(['a', 'b', 'c'])]))] });
    expect(same.perInstance[0]?.undeclaredNew).toEqual([]);
    expect(same.sccOverlapMatches).toBe(0);
    const moved = score({ seeds: [seed(r, await report([scc(['a', 'c'])]), await report([S01_V, scc(['0', 'a', 'c'])]))] });
    expect(moved.perInstance[0]?.undeclaredNew).toEqual([]);
    expect(moved.sccOverlapMatches).toBe(1);
    expect(moved.preExistingIgnored).toBe(1);
  });

  it('a seed expecting an SCC key is detected by member overlap when the smallest member changed', async () => {
    const r = row({ seedId: 'p:MO-S01:1', expected: { functionIds: ['FF-S02'], keys: [key('FF-S02', 'a', '', ['scc'])] } });
    const s = score({ seeds: [seed(r, await report([]), await report([scc(['0', 'a', 'c'])]))] });
    expect(s.perInstance[0]?.status).toBe('matched');
    expect(s.sccOverlapMatches).toBe(1);
  });
});

describe('neural violations (BR-U5b-19)', () => {
  it('a neural violation on an addedByVariant unit is judge collateral, not FP-strict', async () => {
    const b = await report([S01_V], { mode: 'full' });
    const s = await report([S01_V, { functionId: 'FF-N01', filePath: 'src/new.ts', unitId: 'u-new', route: 'neuronal' }], { mode: 'full' });
    const nr = (s.neuralResults as { unitResults: Record<string, unknown>[] }[] | undefined)?.[0];
    if (nr === undefined) throw new Error('full-mode fixture has no neuralResults');
    nr.unitResults.push({
      unitId: 'u-new', unitKind: 'file', layer: 'domain', filePaths: ['src/new.ts'], status: 'valid', verdict: 'fail',
      confidence: 0.9, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 1, origin: 'addedByVariant',
    });
    const r = row({ expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const out = score({ seeds: [seed(r, await report([], { mode: 'full' }), s)] });
    expect(out.judgeCollateral).toBe(1);
    expect(out.overall.get(HELD_OUT)?.strict.fp).toBe(0);
    expect(out.perInstance[0]?.undeclaredNew).toEqual([]);
    expect(baselineMatchKey(S01_V)).toBe(JSON.stringify(['FF-S01', D, I, IMP]));
    expect(b.evaluationMode).toBe('full');
  });
});
