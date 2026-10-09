/**
 * U5b Step 10: strata, edge and judge-probe evidence, denominators and function sensitivity probes
 * (BR-U5b-20..24, 78), on synthetic reports.
 */
import {
  EDGE_EVIDENCE_UNAVAILABLE,
  SENSITIVITY_EXCLUSION_UNSUPPORTED,
  denominatorRow,
  scoreDifferential,
  scoreSensitivity,
  strataOf,
} from '../../../../scripts/score-golden.js';
import type { GoldenScore, ScoreInput, ScoreOutcome } from '../../../../scripts/score-golden.js';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { FNS, key, record, report, row, rule, seed } from './score-fixture.js';
import type { Fn, V } from './score-fixture.js';

const D = 'src/domain/Task.ts';
const I = 'src/infra/Repo.ts';
const IMP = ['IMPORTS'];
const S01_KEY = key('FF-S01', D, I, IMP, 'site-line', 3);
const S01_V: V = { functionId: 'FF-S01', filePath: D, target: I, discriminator: IMP, line: 3 };
const st = (split: string, baseKind: string, coverage: string): string => JSON.stringify([split, baseKind, coverage]);

function ok(o: ScoreOutcome): GoldenScore {
  if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
  return o.score;
}
function score(input: Omit<ScoreInput, 'rule'>): GoldenScore {
  return ok(scoreDifferential({ rule: rule(), ...input }));
}

describe('strata (BR-U5b-20, 21)', () => {
  it('one dev, one held-out and one probe seed → separate dev and held-out rows, no summed row, no probe row', async () => {
    const s01 = (seedId: string, split: 'dev' | 'held-out' | 'probe') => row({ seedId, split, expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });
    const s = score({
      seeds: [
        seed(s01('p:MO-S01:0', 'dev'), await report([]), await report([S01_V])),
        seed(s01('p:MO-S01:1', 'held-out'), await report([]), await report([])),
        seed(s01('p:SP-FF-S01:0', 'probe'), await report([]), await report([S01_V])),
      ],
    });
    expect(s.perInstance.map((i) => i.split)).toEqual(['dev', 'held-out']);
    expect(s.overall.get(st('dev', 'all', 'all'))?.strict).toMatchObject({ tp: 1, fn: 0 });
    expect(s.overall.get(st('held-out', 'all', 'all'))?.strict).toMatchObject({ tp: 0, fn: 1 });
    const strata = [...s.overall.keys(), ...s.perFunction.keys(), ...s.perDimension.keys(), ...s.perTag.keys()];
    expect(strata.every((k) => (JSON.parse(k) as string[])[0] !== 'probe')).toBe(true);
    expect(strata.some((k) => (JSON.parse(k) as string[])[0] === 'all')).toBe(false);
    expect(strataOf({ split: 'held-out', baseKind: 'corpus', coverage: 'in' })).toEqual([
      st('held-out', 'all', 'all'), st('held-out', 'corpus', 'all'), st('held-out', 'all', 'in'),
    ]);
  });

  it('one in-coverage TP and one outside FN → in-coverage recall 1.0, overall 0.5', async () => {
    const r = (seedId: string, coverage: 'in' | 'outside') => row({ seedId, expected: { functionIds: ['FF-S01'], keys: [S01_KEY], coverage } });
    const s = score({
      seeds: [
        seed(r('p:MO-S01:0', 'in'), await report([]), await report([S01_V])),
        seed(r('p:MO-X01:0', 'outside'), await report([]), await report([])),
      ],
    });
    expect(s.overall.get(st('held-out', 'all', 'in'))?.strict.recall).toBe(1);
    expect(s.overall.get(st('held-out', 'all', 'outside'))?.strict.recall).toBe(0);
    expect(s.overall.get(st('held-out', 'all', 'all'))?.strict.recall).toBe(0.5);
  });
});

describe('edge evidence (BR-U5b-22)', () => {
  const df01 = (negative: boolean) =>
    row({
      seedId: negative ? 'p:MO-DF01n:0' : 'p:MO-DF01:0',
      expected: negative
        ? { negative: true, twinOf: 'MO-DF01', functionIds: [], keys: [], expectedEdges: [{ type: 'FLOWS_TO', source: 'A', target: 'B', via: 'new' }] }
        : { functionIds: ['FF-P06'], dimension: 'pattern', keys: [key('FF-P06', D, I, ['Task'])], expectedEdges: [{ type: 'FLOWS_TO', source: 'A', target: 'B', via: 'new' }] },
    });
  async function withEdges(n: number | null, vs: readonly V[] = []): Promise<Awaited<ReturnType<typeof report>>> {
    const r = await report(vs);
    (r as unknown as EvaluationReport & { graphStats: { edgeCountByType: Record<string, number> } }).graphStats.edgeCountByType = n === null ? {} : { IMPORTS: 3, FLOWS_TO: n };
    return r;
  }

  it('FLOWS_TO 0 → 1 with one declared edge passes; 0 → 2 fails; the twin is reported too', async () => {
    const pass = score({ seeds: [seed(df01(false), await withEdges(0), await withEdges(1)), seed(df01(true), await withEdges(0), await withEdges(1))] });
    expect(pass.edgeEvidence).toEqual([
      { seedId: 'p:MO-DF01:0', negative: false, edgeType: 'FLOWS_TO', baseline: 0, seeded: 1, delta: 1, declared: 1, pass: true },
      { seedId: 'p:MO-DF01n:0', negative: true, edgeType: 'FLOWS_TO', baseline: 0, seeded: 1, delta: 1, declared: 1, pass: true },
    ]);
    const fail = score({ seeds: [seed(df01(false), await withEdges(0), await withEdges(2))] });
    expect(fail.edgeEvidence[0]).toMatchObject({ delta: 2, declared: 1, pass: false });
  });

  it('an empty edgeCountByType in either report → EDGE_EVIDENCE_UNAVAILABLE', async () => {
    const o = scoreDifferential({ rule: rule(), seeds: [seed(df01(false), await withEdges(0), await withEdges(null))] });
    expect(o.ok ? 'scored' : o.code).toBe(EDGE_EVIDENCE_UNAVAILABLE);
  });
});

describe('judge probes (BR-U5b-23)', () => {
  const judgeFns: readonly Fn[] = [...FNS, { functionId: 'FF-N02', name: 'intent-alignment', dimension: 'semantic', tag: 'structural' }];
  interface Unit { unitId: string; filePaths: string[]; verdict: 'pass' | 'fail' }
  async function judged(units: readonly Unit[], selected: readonly string[]): Promise<Awaited<ReturnType<typeof report>>> {
    const r = await report([], { mode: 'full', fns: judgeFns });
    const rows = r.neuralResults as { functionId: string; selection: { candidateUnitIds: string[]; selectedUnitIds: string[] }; unitResults: Record<string, unknown>[] }[];
    const nr = rows.find((n) => n.functionId === 'FF-N02');
    if (nr === undefined) throw new Error('no FF-N02 neural row');
    nr.selection = { ...nr.selection, candidateUnitIds: units.map((u) => u.unitId), selectedUnitIds: [...selected] };
    nr.unitResults = units.map((u) => ({
      unitId: u.unitId, unitKind: 'file', layer: 'domain', filePaths: u.filePaths, status: 'valid', verdict: u.verdict,
      confidence: 0.9, confidenceStdDev: 0, flaggedUnstable: false, validRunCount: 1,
    }));
    return r;
  }
  const probeRow = (file: string) => row({ seedId: 'p:MO-X02:0', operatorId: 'MO-X02', editedFiles: [file], expected: { functionIds: [], dimension: 'semantic', judgeProbe: 'semantic' } });

  it('a probe file inside a selected unit failing only in the seeded report → detected, inSelection true', async () => {
    const b = await judged([{ unitId: 'u1', filePaths: [D], verdict: 'pass' }], ['u1']);
    const s = await judged([{ unitId: 'u1', filePaths: [D], verdict: 'fail' }], ['u1']);
    const out = score({ seeds: [seed(probeRow(D), b, s, { seeded: record({ cell: { runIndex: 1 } as never }) })] });
    expect(out.judgeProbe).toEqual([{ seedId: 'p:MO-X02:0', probe: 'semantic', negative: false, runIndex: 1, detected: true, inSelection: true, coverageShare: 1 }]);
    expect(out.perInstance).toEqual([]);
  });

  it('a probe file outside every selected unit → inSelection false, reported in the conditional row; a twin is a judge FP probe', async () => {
    const b = await judged([{ unitId: 'u1', filePaths: [D], verdict: 'pass' }, { unitId: 'u2', filePaths: [I], verdict: 'pass' }], ['u1']);
    const s = await judged([{ unitId: 'u1', filePaths: [D], verdict: 'pass' }, { unitId: 'u2', filePaths: [I], verdict: 'fail' }], ['u1']);
    const twin = row({ seedId: 'p:MO-X02n:0', operatorId: 'MO-X02n', editedFiles: [I], expected: { negative: true, twinOf: 'MO-X02', functionIds: [], keys: [] } });
    const out = score({ seeds: [seed(probeRow(I), b, s), seed(twin, b, s)] });
    expect(out.judgeProbe.map((p) => [p.seedId, p.negative, p.detected, p.inSelection, p.coverageShare])).toEqual([
      ['p:MO-X02:0', false, true, false, 0],
      ['p:MO-X02n:0', true, true, false, 0],
    ]);
    expect(out.twinSpecificity).toEqual({ clean: 0, scored: 0 });
  });
});

describe('denominators and identities (BR-U5b-24)', () => {
  it('the counts equal the report fields; adrDerived 2 with one dropped id holds I1 and I2', async () => {
    const r = await report([]);
    r.functionExecution = { ...r.functionExecution, declared: 4, adrDerived: 2, compiled: 5, disabled: 0, dropped: ['FF-X'], skippedByMode: 1, executed: 4, failed: [] };
    const d = denominatorRow('s', 'run-1', r as unknown as EvaluationReport, 1, 0);
    expect(d).toEqual({
      seedId: 's', runId: 'run-1', declared: 4, adrDerived: 2, compiled: 5, disabled: 0, dropped: 1, droppedIds: ['FF-X'], skippedByMode: 1,
      executed: 4, failed: 0, notApplicable: 1, metricKeyExcluded: 0, identityOk: true,
    });
  });

  it('a hand-edited report breaking I2 has identityOk false', async () => {
    const r = await report([]);
    r.functionExecution = { ...r.functionExecution, declared: 4, adrDerived: 0, compiled: 4, disabled: 0, dropped: [], skippedByMode: 0, executed: 3, failed: [] };
    expect(denominatorRow(null, 'run-2', r as unknown as EvaluationReport, 0, 0).identityOk).toBe(false);
  });

  it('scoreDifferential writes one row per report: the shared baseline once, then each seeded run', async () => {
    const b = await report([]);
    const bRec = record({ runId: 'run-base', reportPath: 'b.json' });
    const s = score({
      seeds: [
        seed(row({ seedId: 'p:MO-S01:0', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), b, await report([S01_V]), { baseline: bRec, seeded: record({ runId: 'run-a' }) }),
        seed(row({ seedId: 'p:MO-S01:1', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } }), b, await report([]), { baseline: bRec, seeded: record({ runId: 'run-b' }) }),
      ],
    });
    expect(s.denominators.map((d) => [d.seedId, d.runId, d.identityOk])).toEqual([
      [null, 'run-base', true], ['p:MO-S01:0', 'run-a', true], ['p:MO-S01:1', 'run-b', true],
    ]);
  });
});

describe('function sensitivity probes (BR-U5b-78)', () => {
  const probe = (seedId: string) => row({ seedId, operatorId: 'SP-FF-S01', split: 'probe', expected: { functionIds: ['FF-S01'], keys: [S01_KEY] } });

  it('a new row at the declared key → pass true; a new row at another key → false; a rejected run → null', async () => {
    const other: V = { ...S01_V, target: 'src/infra/Other.ts' };
    const failedRun = await report([]);
    failedRun.functionExecution.failed = [{ functionId: 'FF-S01', name: 'dependency-direction', code: 'EVAL_002', message: 't' }];
    const o = scoreSensitivity({
      rule: rule(),
      probes: [seed(probe('p:SP-FF-S01:0'), await report([]), await report([S01_V])), seed(probe('p:SP-FF-S01:1'), await report([]), await report([other])), seed(probe('p:SP-FF-S01:2'), await report([]), failedRun)],
    });
    if (!o.ok) throw new Error(o.detail);
    expect(o.results.map((r) => [r.pass, r.lineConfirmed, r.excludedAfterFail])).toEqual([[true, true, false], [false, null, false], [null, null, false]]);
    expect(o.results[2]?.rejectedReason).toContain('function-timeout');
  });

  it('collateral-declared probes (catalogue §5): FF-S02 by its cycle key, FF-C06 keyless by any new row; target from the probe id', async () => {
    const cycle = 'src/domain/Task.ts,src/infra/Repo.ts,src/domain/Task.ts';
    const s02 = row({ seedId: 'p:SP-FF-S02:0', operatorId: 'SP-FF-S02', split: 'probe', expected: { collateral: [
      { kind: 'site', template: 'no-cyclic-deps', functionId: 'FF-S02', cause: 'cycle', key: key('FF-S02', cycle, I, ['cycle']) },
    ] } });
    const c06 = row({ seedId: 'p:SP-FF-C06:0', operatorId: 'SP-FF-C06', split: 'probe', expected: { collateral: [
      { kind: 'site', template: 'no-orphan-files', functionId: 'FF-C04', cause: 'metric-crossing', key: key('FF-C04', 'src/x.ts') },
      { kind: 'project', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' },
    ] } });
    const cycleV: V = { functionId: 'FF-S02', filePath: cycle, target: I, discriminator: ['cycle'] };
    const o = scoreSensitivity({
      rule: rule(),
      probes: [
        seed(s02, await report([]), await report([cycleV])),
        seed({ ...c06, seedId: 'p:SP-FF-C06:0' }, await report([]), await report([{ functionId: 'FF-C06', filePath: '' }])),
        seed({ ...c06, seedId: 'p:SP-FF-C06:1' }, await report([]), await report([{ functionId: 'FF-C04', filePath: 'src/x.ts' }])),
      ],
    });
    if (!o.ok) throw new Error(o.detail);
    expect(o.results.map((r) => [r.probeId, r.functionId, r.pass])).toEqual([
      ['SP-FF-C06', 'FF-C06', true], ['SP-FF-C06', 'FF-C06', false], ['SP-FF-S02', 'FF-S02', true],
    ]);
  });

  it('a failed probe with a later disabled spec entry and a fixAttempts ref → excludedAfterFail with the ref', async () => {
    const o = scoreSensitivity({
      rule: rule(),
      probes: [seed(probe('p:SP-FF-S01:0'), await report([]), await report([]))],
      laterDisabled: new Set(['FF-S01']),
      fixAttempts: [{ functionId: 'FF-S01', ref: 'tests/golden/CHANGES.md:12' }],
    });
    if (!o.ok) throw new Error(o.detail);
    expect(o.results[0]).toMatchObject({ pass: false, excludedAfterFail: true, fixAttemptRef: 'tests/golden/CHANGES.md:12' });
  });

  it('a disabled function without a failed probe (or without a fix attempt) → SENSITIVITY_EXCLUSION_UNSUPPORTED', async () => {
    const passed = scoreSensitivity({
      rule: rule(), probes: [seed(probe('p:SP-FF-S01:0'), await report([]), await report([S01_V]))],
      laterDisabled: new Set(['FF-S01']), fixAttempts: [{ functionId: 'FF-S01', ref: 'abc1234' }],
    });
    expect(passed.ok ? 'ok' : passed.code).toBe(SENSITIVITY_EXCLUSION_UNSUPPORTED);
    const noFix = scoreSensitivity({ rule: rule(), probes: [seed(probe('p:SP-FF-S01:0'), await report([]), await report([]))], laterDisabled: new Set(['FF-S01']) });
    expect(noFix.ok ? 'ok' : noFix.code).toBe(SENSITIVITY_EXCLUSION_UNSUPPORTED);
  });
});
