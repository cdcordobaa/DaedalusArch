/**
 * U5b Step 8: differential scorer core (BR-U5b-02..11, 25), on synthetic reports.
 */
import {
  SCORE_COLLATERAL_UNKEYED,
  SCORE_INPUT_REJECTED,
  baselineMatchKey,
  computePrf,
  multisetDifference,
  remapLine,
  scoreDifferential,
} from '../../../../scripts/score-golden.js';
import type { GoldenScore, ReconciledP1Label, ScoreOutcome } from '../../../../scripts/score-golden.js';
import { HELD_OUT, key, record, report, row, rule, seed } from './score-fixture.js';

const D = 'src/domain/Task.ts';
const I = 'src/infra/Repo.ts';
const IMP = ['IMPORTS'];

function ok(o: ScoreOutcome): GoldenScore {
  if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
  return o.score;
}

function cell<T>(m: ReadonlyMap<string, ReadonlyMap<string, T>>, stratum: string, k: string): T {
  const v = m.get(stratum)?.get(k);
  if (v === undefined) throw new Error(`no cell ${stratum} / ${k}`);
  return v;
}

const s01Seed = (over: Record<string, unknown> = {}) =>
  row({ expected: { functionIds: ['FF-S01', 'FF-S04'], keys: [key('FF-S01', D, I, IMP, 'site-line', 3), key('FF-S04', D, I, IMP, 'site-line', 3)], ...over } });

describe('baselineMatchKey (BR-U5b-02)', () => {
  it('ignores line, lines, id, message and evidence', () => {
    const a = { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 1, id: 'v-1', message: 'a', evidence: ['x=1'] };
    const b = { ...a, line: 9, lines: [9], id: 'v-2', message: 'b', evidence: ['x=2'] };
    expect(baselineMatchKey(a)).toBe(baselineMatchKey(b));
    expect(baselineMatchKey({ functionId: 'FF-C04', filePath: D })).toBe(JSON.stringify(['FF-C04', D, '', []]));
  });

  it('round-trips file paths holding |, " and , through JSON.parse', () => {
    const odd = 'src/a|b"c,d.ts';
    const k = baselineMatchKey({ functionId: 'FF-S01', filePath: odd, target: 'x,y', discriminator: ['p|q'] });
    expect(JSON.parse(k)).toEqual(['FF-S01', odd, 'x,y', ['p|q']]);
  });
});

describe('multiset difference and preExistingIgnored (BR-U5b-03)', () => {
  it('baseline {k1,k2}, seeded {k1,k1,k2,k3} → new {k1,k3}, preExisting 2', () => {
    const d = multisetDifference(['k1', 'k2'], ['k1', 'k1', 'k2', 'k3']);
    expect([...d.newKeys]).toEqual([['k1', 1], ['k3', 1]]);
    expect(d.preExisting).toBe(2);
  });

  it('scoreDifferential sums baseline-matched occurrences into preExistingIgnored, neither TP nor FP', async () => {
    const pre = { functionId: 'FF-CV05', filePath: 'src/x.ts' };
    const b = await report([pre, { functionId: 'FF-CV05', filePath: 'src/y.ts' }]);
    const s = await report([pre, pre, { functionId: 'FF-CV05', filePath: 'src/y.ts' }, { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), b, s)] }));
    expect(score.preExistingIgnored).toBe(2);
    // The duplicated CV05 occurrence is new and undeclared → FP-strict.
    expect(score.perInstance[0]?.undeclaredNew).toEqual([baselineMatchKey(pre)]);
  });
});

describe('detection and line confirmation (BR-U5b-04)', () => {
  it('seed key present with a shifted line → TP, lineConfirmed false', async () => {
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 4 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] }));
    expect(score.perInstance[0]?.status).toBe('matched');
    expect(score.perInstance[0]?.lineConfirmed).toBe(false);
  });

  it('seed key absent → FN (missed)', async () => {
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: 'src/infra/Other.ts', discriminator: IMP, line: 3 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] }));
    expect(score.perInstance[0]?.status).toBe('missed');
    expect(cell(score.perDimension, HELD_OUT, 'structural').strict).toMatchObject({ tp: 0, fn: 1, fp: 1 });
  });

  it('an injection row with no line → TP, lineConfirmed null; a confirmed line → true', async () => {
    const noLine = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP }]);
    const a = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), noLine)] }));
    expect(a.perInstance[0]).toMatchObject({ status: 'matched', lineConfirmed: null });
    const atLine = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 }]);
    const b = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), atLine)] }));
    expect(b.perInstance[0]?.lineConfirmed).toBe(true);
  });

  it('remapLine shifts baseline lines after afterLine by delta, per file and in order', () => {
    const shifts = [{ filePath: D, afterLine: 0, delta: 2 }, { filePath: D, afterLine: 19, delta: 1 }];
    expect(remapLine(1, D, shifts)).toBe(3);
    expect(remapLine(18, D, shifts)).toBe(21);
    expect(remapLine(5, I, shifts)).toBe(5);
  });
});

describe('count-once and per-function rows (BR-U5b-05, 06)', () => {
  it('a seed detected by two functions counts TP 1 at dimension and overall, detectedBy both', async () => {
    const s = await report([
      { functionId: 'FF-S04', filePath: D, target: I, discriminator: IMP, line: 3 },
      { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 },
    ]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] }));
    expect(score.perInstance[0]?.detectedBy).toEqual(['FF-S01', 'FF-S04']);
    expect(cell(score.perDimension, HELD_OUT, 'structural').strict).toMatchObject({ tp: 1, fp: 0, fn: 0 });
    expect(score.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fp: 0, fn: 0 });
  });

  it('two expected functions, one firing → per-function TP 1 / FN 1; overall TP 1', async () => {
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] }));
    expect(cell(score.perFunction, HELD_OUT, 'FF-S01').strict).toMatchObject({ tp: 1, fn: 0 });
    expect(cell(score.perFunction, HELD_OUT, 'FF-S04').strict).toMatchObject({ tp: 0, fn: 1 });
    expect(score.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fn: 0 });
  });
});

describe('dimension and tag tables (BR-U5b-07)', () => {
  it('an MO-DF01 seed appears under structural and in the structural/data-flow sub-row', async () => {
    const k = key('FF-P06', D, I, ['Task', 'Repo', 'FLOWS_TO', 'repo'], 'site-line', 5);
    const r = row({ seedId: 'p:MO-DF01:0', expected: { functionIds: ['FF-P06'], dimension: 'pattern', keys: [k] } });
    const s = await report([{ functionId: 'FF-P06', filePath: D, target: I, discriminator: ['Task', 'Repo', 'FLOWS_TO', 'repo'], line: 5 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(r, await report([]), s)] }));
    expect(cell(score.perTag, HELD_OUT, 'structural').strict.tp).toBe(1);
    expect(cell(score.perTag, HELD_OUT, 'structural/data-flow').strict.tp).toBe(1);
    expect(cell(score.perDimension, HELD_OUT, 'pattern').strict.tp).toBe(1);
  });

  it('a seed whose expected functions carry two tags appears once in each tag table', async () => {
    const r = row({ expected: { functionIds: ['FF-S01', 'FF-S02'], keys: [key('FF-S01', D, I, IMP)] } });
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(r, await report([]), s)] }));
    expect(score.perInstance[0]?.tags).toEqual(['structural', 'topological']);
    expect(cell(score.perTag, HELD_OUT, 'structural').strict.tp).toBe(1);
    expect(cell(score.perTag, HELD_OUT, 'topological').strict.tp).toBe(1);
  });
});

describe('collateral (BR-U5b-08)', () => {
  const df01 = (collateral: readonly Record<string, unknown>[]) =>
    row({
      seedId: 'p:MO-DF01:0',
      expected: { functionIds: ['FF-P06'], dimension: 'pattern', keys: [key('FF-P06', D, I, ['Task'], 'site-line', 5)], collateral },
    });
  const keyedOp = { kind: 'operator', template: 'dependency-direction', functionId: 'FF-S01', cause: 'declared', key: key('FF-S01', D, I, IMP, 'site-line', 1) };

  it('keyed operator collateral is neutral; an undeclared new violation of the same function elsewhere is FP-strict', async () => {
    const s = await report([
      { functionId: 'FF-P06', filePath: D, target: I, discriminator: ['Task'], line: 5 },
      { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 1 },
      { functionId: 'FF-S01', filePath: 'src/domain/Other.ts', target: I, discriminator: IMP, line: 1 },
    ]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(df01([keyedOp]), await report([]), s)] }));
    expect(score.perInstance[0]?.collateral).toEqual([baselineMatchKey({ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP })]);
    expect(score.perInstance[0]?.undeclaredNew).toEqual([baselineMatchKey({ functionId: 'FF-S01', filePath: 'src/domain/Other.ts', target: I, discriminator: IMP })]);
    expect(score.collateralByFunction.get('FF-S01')).toBe(1);
    expect(cell(score.perFunction, HELD_OUT, 'FF-S01').strict).toMatchObject({ tp: 0, fp: 1, fn: 0 });
  });

  it('a keyless project-metric entry neutralises its function on <project> and no file row', async () => {
    const pm = { kind: 'site', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' };
    const s = await report([
      { functionId: 'FF-P06', filePath: D, target: I, discriminator: ['Task'], line: 5 },
      { functionId: 'FF-C06', filePath: '<project>' },
      { functionId: 'FF-C06', filePath: 'src/domain/x.ts' },
    ]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(df01([pm]), await report([]), s)] }));
    expect(score.perInstance[0]?.collateral).toEqual([baselineMatchKey({ functionId: 'FF-C06', filePath: '<project>' })]);
    expect(score.perInstance[0]?.undeclaredNew).toEqual([baselineMatchKey({ functionId: 'FF-C06', filePath: 'src/domain/x.ts' })]);
  });

  it('a keyless operator entry is refused with SCORE_COLLATERAL_UNKEYED, naming seed and template', async () => {
    const keyless = { kind: 'operator', template: 'dependency-direction', functionId: 'FF-S01', cause: 'declared' };
    const o = scoreDifferential({ rule: rule(), seeds: [seed(df01([keyless]), await report([]), await report([]))] });
    expect(o.ok).toBe(false);
    if (o.ok) return;
    expect(o.code).toBe(SCORE_COLLATERAL_UNKEYED);
    expect(o.detail).toContain('p:MO-DF01:0');
    expect(o.detail).toContain('dependency-direction');
  });

  it('a seed detected only by a collateral function is FN', async () => {
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 1 }]);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(df01([keyedOp]), await report([]), s)] }));
    expect(score.perInstance[0]?.status).toBe('missed');
    expect(cell(score.perFunction, HELD_OUT, 'FF-P06').strict).toMatchObject({ tp: 0, fn: 1 });
  });
});

describe('FP-strict and FP-labelled (BR-U5b-09, 10)', () => {
  it('one undeclared new violation → fpStrict 1 and one P1 item with that key', async () => {
    const extra = { functionId: 'FF-C04', filePath: 'src/orphan.ts' };
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 }, extra]);
    const o = scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] });
    expect(o.ok).toBe(true);
    if (!o.ok) return;
    expect(o.score.overall.get(HELD_OUT)?.strict.fp).toBe(1);
    expect(o.labelItems).toHaveLength(1);
    expect(o.labelItems[0]).toMatchObject({ kind: 'violation', population: 'P1', key: baselineMatchKey(extra), inclusionProbability: 1, seedId: 'p:MO-S01:0' });
    expect(o.labelItems[0]?.itemId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('3 FP-strict with labels {unseeded-TP, FP, uncertain} → FP-labelled 2, fpUncertain 1; no labels → null', async () => {
    const files = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const fps = files.map((f) => ({ functionId: 'FF-C04', filePath: f }));
    const s = await report([{ functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 }, ...fps]);
    const input = { rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] };
    const first = scoreDifferential(input);
    if (!first.ok) throw new Error(first.detail);
    const byKey = new Map(first.labelItems.map((i) => [i.key, i.itemId]));
    const id = (f: string): string => byKey.get(baselineMatchKey({ functionId: 'FF-C04', filePath: f })) ?? '';
    const labels = new Map<string, ReconciledP1Label>([
      [id('src/a.ts'), 'unseeded-TP'],
      [id('src/b.ts'), 'FP'],
      [id('src/c.ts'), 'uncertain'],
    ]);
    const labelled = ok(scoreDifferential({ ...input, labels }));
    const overall = labelled.overall.get(HELD_OUT);
    expect(overall?.strict.fp).toBe(3);
    expect(overall?.labelled?.fp).toBe(2);
    expect(overall?.fpUncertain).toBe(1);
    expect(first.score.overall.get(HELD_OUT)?.labelled).toBeNull();
    expect(first.score.overall.get(HELD_OUT)?.strict.precision).toBeCloseTo(0.25, 10);
  });
});

describe('computePrf (BR-U5b-11)', () => {
  it('a zero denominator gives null, never 0 or NaN', () => {
    expect(computePrf({ tp: 0, fp: 0, fn: 0 })).toEqual({ tp: 0, fp: 0, fn: 0, precision: null, recall: null, f1: null });
    expect(computePrf({ tp: 0, fp: 0, fn: 3 })).toEqual({ tp: 0, fp: 0, fn: 3, precision: null, recall: 0, f1: null });
    expect(computePrf({ tp: 0, fp: 2, fn: 3 })).toEqual({ tp: 0, fp: 2, fn: 3, precision: 0, recall: 0, f1: null });
    const p = computePrf({ tp: 3, fp: 1, fn: 1 });
    expect(p.precision).toBe(0.75);
    expect(p.recall).toBe(0.75);
    expect(p.f1).toBeCloseTo(0.75, 12);
  });
});

describe('input rejection (BR-U5b-25)', () => {
  async function rejected(o: Promise<ScoreOutcome> | ScoreOutcome): Promise<string> {
    const r = await o;
    if (r.ok) throw new Error('expected a rejection');
    expect(r.code).toBe(SCORE_INPUT_REJECTED);
    return r.detail;
  }

  it('a baseline with functionExecution.failed non-empty is rejected', async () => {
    const b = await report([]);
    b.functionExecution.failed = [{ functionId: 'FF-S01', name: 'dependency-direction', code: 'EVAL_001', message: 'boom' }];
    const detail = await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), b, await report([]))] }));
    expect(detail).toContain('baseline report rejected (function-failed');
  });

  it('records with differing specSha or cliCommit are rejected', async () => {
    const [b, s] = [await report([]), await report([])];
    expect(await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), b, s, { seeded: record({ specSha: 'd'.repeat(64) }) })] }))).toContain('specSha differs');
    expect(await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), b, s, { seeded: record({ cliCommit: 'e'.repeat(40) }) })] }))).toContain('cliCommit differs');
  });

  it('differing evaluationMode is rejected', async () => {
    const detail = await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), await report([], { mode: 'full' }))] }));
    expect(detail).toContain('evaluationMode differs');
  });

  it('differing judge provenance is rejected', async () => {
    const s = await report([]);
    s.judge = { ...s.judge, model: 'other-model' };
    expect(await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), s)] }))).toContain('judge differs');
  });

  it('a report passed without its RunRecord is rejected', async () => {
    const detail = await rejected(scoreDifferential({ rule: rule(), seeds: [seed(s01Seed(), await report([]), await report([]), { seeded: null })] }));
    expect(detail).toContain('seeded report without its RunRecord');
  });
});
