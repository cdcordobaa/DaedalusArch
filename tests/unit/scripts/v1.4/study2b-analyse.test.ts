/**
 * Study 2b analysis helpers (scripts/v1.4/lib/study2b-analyse.ts) and the D† helpers (scripts/v1.4/lib/d-dagger.ts):
 * the tests, Holm, the bootstraps, E, V4 parts A and B, the planted data set, and the 2a report §3 reproduction.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CONTRASTS, analyseContrast, semanticReading, equivalence, familyDecision, halves, holmDecisions, mcSignFlipP, partA, partB, plantedBlocks,
  recallByFamily, signTestP, signedRankP, supportedUnderBoth, taskClusterBootstrap, withinTaskBootstrap,
  type Block, type Cell, type ContrastResult, type FamilyDecision,
} from '../../../../scripts/v1.4/lib/study2b-analyse';
import { exactSignFlipP } from '../../../../scripts/v1.4/lib/study2b-power';
import { cellRatio, summariseCell, type RunD } from '../../../../scripts/v1.4/lib/stage-c';
import { cellEvasion, daggerEdges, evasionFlag, newEdgesByStep, renamesToExempt } from '../../../../scripts/v1.4/lib/d-dagger';

const REPO = path.resolve(__dirname, '../../../..');

function block(id: string, task: string, rep: number, l2: number | null, l3: number | null, mcp: number | null, y1 = 1): Block {
  return { block: id, task, rep, Y1: y1, D: { 'none@L2': l2, 'none@L3': l3, 'mcp@L2': mcp }, Yk: { 'none@L2': null, 'none@L3': null, 'mcp@L2': null } };
}

/** The 2a Stage C blocks (report §3), in the report order. */
const A2: Block[] = [
  block('hive-health/rep1', 'hive-health', 1, 1, 2, 1, 1), block('hive-health/rep2', 'hive-health', 2, 0, 0, 0, 1),
  block('ice-rink/rep1', 'ice-rink', 1, 1, 0, 0, 4), block('ice-rink/rep2', 'ice-rink', 2, 3, 2, 0, 4),
  block('youth-league/rep1', 'youth-league', 1, 2, 0, 0, 1), block('youth-league/rep2', 'youth-league', 2, 2, 0, 2, 1),
];

describe('the sign-flip test', () => {
  it('Monte Carlo p estimates the exact p', () => {
    const d = [1, 2, 0, 3, 1, -1, 2, 1];
    const mc = mcSignFlipP(d, 20_000, 7);
    expect(Math.abs(mc - exactSignFlipP(d))).toBeLessThan(0.01);
  });
  it('has the registered floor: (1 + 0) / (1 + draws) when nothing is as extreme', () => {
    expect(mcSignFlipP([], 10, 1)).toBe(1);
    expect(mcSignFlipP([5], 99, 1)).toBe(1); // |T*| = |T| always for one difference
  });
  it('2a H1 and H2: exact p = 0.25, never below the floor', () => {
    const h1 = analyseContrast(A2, CONTRASTS[0]!, { draws: 2000, resamples: 200 });
    const h2 = analyseContrast(A2, CONTRASTS[1]!, { draws: 2000, resamples: 200 });
    expect(h1.diffs).toEqual([-1, 0, 1, 1, 2, 2]);
    expect(h2.diffs).toEqual([0, 0, 1, 3, 2, 0]);
    expect(h1.exactP).toBeCloseTo(0.25, 10);
    expect(h2.exactP).toBeCloseTo(0.25, 10);
    expect(h1.rr).toBeCloseTo(4 / 9, 10);
    expect(h2.taskLevel.smallestPossibleP).toBeCloseTo(2 / 8, 10);
  });
});

describe('robustness tests', () => {
  it('sign test: exact binomial, two-sided', () => {
    expect(signTestP([1, 1, 1]).p).toBeCloseTo(0.25, 10);
    expect(signTestP([1, -1]).p).toBe(1);
    expect(signTestP([0, 0]).p).toBe(1);
  });
  it('signed-rank: midranks, exact', () => {
    expect(signedRankP([1, 2, 3])).toBeCloseTo(0.25, 10);
    expect(signedRankP([3, 3, -3])).toBeCloseTo(1, 10);
  });
});

describe('Holm', () => {
  it('steps down and stops at the first non-rejection', () => {
    const h = holmDecisions([{ id: 'H1', p: 0.01 }, { id: 'H2', p: 0.02 }, { id: 'H3', p: 0.04 }]);
    expect(h.map((x) => x.reject)).toEqual([true, true, true]);
    const g = holmDecisions([{ id: 'H1', p: 0.02 }, { id: 'H2', p: 0.001 }, { id: 'H3', p: 0.04 }]);
    expect(g.find((x) => x.id === 'H1')?.alphaStep).toBeCloseTo(0.025, 10);
    expect(g.map((x) => x.reject)).toEqual([true, true, true]);
    const k = holmDecisions([{ id: 'H1', p: 0.03 }, { id: 'H2', p: 0.001 }, { id: 'H3', p: 0.03 }]);
    expect(k.map((x) => x.reject)).toEqual([false, true, false]);
  });
  it('the exact-p decisions govern when MC and exact disagree', () => {
    const r = (id: 'H1' | 'H2' | 'H3', mcP: number, exactP: number, T: number): ContrastResult => ({ ...analyseContrast(A2, CONTRASTS.find((c) => c.id === id)!, { draws: 10, resamples: 10 }), mcP, exactP, T });
    const d = familyDecision([r('H1', 0.03, 0.02, 5), r('H2', 0.001, 0.001, 6), r('H3', 0.9, 0.9, 0)]);
    expect(d.disagree).toBe(true);
    expect(d.governing).toBe('exact');
    expect(d.decisions.H1?.reject).toBe(true); // exact 0.02 <= 0.025 at Holm step 2; MC 0.03 is not
    const e = familyDecision([r('H1', 0.02, 0.03, 5), r('H2', 0.001, 0.001, 6), r('H3', 0.9, 0.9, 0)]);
    expect(e.governing).toBe('exact');
    expect(e.decisions.H1?.reject).toBe(false);
    const same = familyDecision([r('H1', 0.016, 0.018, 5), r('H2', 0.001, 0.001, 6), r('H3', 0.9, 0.9, 0)]);
    expect(same.disagree).toBe(false);
  });
});

describe('the D / D† agreement rule (finding 2)', () => {
  const dec = (h1: boolean, sign: boolean): FamilyDecision => ({ family: ['H1', 'H2'], holmMc: [], holmExact: [], disagree: false, governing: 'mc', decisions: { H1: { reject: h1, predictedSign: sign, supportedUnderThisOutcome: h1 && sign }, H2: { reject: false, predictedSign: true, supportedUnderThisOutcome: false } } });
  it('supports only when both agree', () => {
    expect(supportedUnderBoth(dec(true, true), dec(true, true)).H1?.supported).toBe(true);
    expect(supportedUnderBoth(dec(true, true), dec(false, true)).H1?.reading).toMatch(/composition-root exemption only/);
    expect(supportedUnderBoth(dec(true, true), null).H1?.supported).toBe(false);
    expect(supportedUnderBoth(dec(false, true), dec(false, false)).H1?.reading).toMatch(/not rejected under D or D†/);
  });
});

describe('the D_sem reading (DELEG11)', () => {
  it('survives when Holm decisions and signs agree; depends on the semantic layer otherwise', () => {
    const r = CONTRASTS.map((c) => analyseContrast(A2, c, { draws: 500, resamples: 50 }));
    const d = familyDecision(r);
    expect(semanticReading(d, d).H1?.reading).toMatch(/survives/);
    const flipped: FamilyDecision = { ...d, decisions: { ...d.decisions, H1: { reject: true, predictedSign: true, supportedUnderThisOutcome: true, sign: 1 } } };
    expect(semanticReading(d, flipped).H1?.reading).toMatch(/depends on the semantic layer/);
    expect(semanticReading(d, null).H1?.survives).toBeNull();
    const h3a: FamilyDecision = { ...d, decisions: { ...d.decisions, H3: { reject: true, predictedSign: null, supportedUnderThisOutcome: null, sign: 1 } } };
    const h3b: FamilyDecision = { ...d, decisions: { ...d.decisions, H3: { reject: true, predictedSign: null, supportedUnderThisOutcome: null, sign: -1 } } };
    expect(semanticReading(h3a, h3b).H3?.survives).toBe(false);
  });
});

describe('bootstraps', () => {
  it('within-task keeps each stratum size; a constant statistic has a point interval', () => {
    const items = [{ task: 'a', v: 1 }, { task: 'a', v: 1 }, { task: 'b', v: 1 }];
    const b = withinTaskBootstrap(items, (s) => s.length, 1, 100);
    expect(b.low).toBe(3);
    expect(b.high).toBe(3);
  });
  it('the task-cluster bootstrap reproduces Stage C (2a report §3) at seed 20261019', () => {
    const runs = (cell: Cell): RunD[] => A2.map((b) => ({ cell, task: b.task, rep: b.rep, D: b.D[cell], Y1: b.Y1, Yk: null, inheritedRemoved: null }));
    for (const cell of ['none@L2', 'none@L3', 'mcp@L2'] as const) {
      const s = summariseCell(cell, runs(cell));
      const mine = taskClusterBootstrap(A2.map((b) => ({ task: b.task, d: b.D[cell] as number })), (x) => x.reduce((a, y) => a + y.d, 0) / x.length, 20261019, 10_000);
      expect([mine.low, mine.high]).toEqual([s.D.meanInterval?.low, s.D.meanInterval?.high]);
    }
    const ratio = cellRatio(runs('none@L3'), runs('none@L2'));
    const items = A2.map((b) => ({ task: b.task, a: b.D['none@L3'] as number, r: b.D['none@L2'] as number }));
    const mine = taskClusterBootstrap(items, (s) => s.reduce((x, p) => x + p.a, 0) / s.reduce((x, p) => x + p.r, 0), 20261019, 10_000);
    expect([mine.low, mine.high]).toEqual([ratio.ratio?.low, ratio.ratio?.high]);
    // The 2a report §3 values.
    expect([ratio.ratio?.low, ratio.ratio?.high]).toEqual([0, 2]);
  });
});

describe('equivalence E (finding 7)', () => {
  it('is "not established" when the interval is inside ±Δ but the treated cells barely drift', () => {
    const bs = Array.from({ length: 12 }, (_, i) => block(`t${String(i % 4)}/rep${String(i)}`, `t${String(i % 4)}`, i, 2, 0, 0));
    const e = equivalence(bs, { resamples: 200 });
    expect(e.withinDelta).toBe(true);
    expect(e.established).toBe(false);
    expect(e.reading).toMatch(/not established/);
  });
});

describe('V4 (finding 5)', () => {
  const rf = { 'FF-S01': 2 / 3, 'FF-S02': 1, 'FF-S03': 1 };
  it('part A: s_c = 0 when a cell has no identity (vacuous), and uninformative when one family dominates', () => {
    const a = partA({ 'none@L2': ['FF-S03', 'FF-S03'], 'none@L3': [], 'mcp@L2': ['FF-S03'] }, rf, 7 / 8, [['none@L2', 'none@L3'], ['none@L2', 'mcp@L2']]);
    expect(a.cells.find((c) => c.cell === 'none@L3')?.vacuous).toBe(true);
    expect(a.cells.find((c) => c.cell === 'none@L3')?.m).toBe(0);
    expect(a.uninformative).toBe(true);
    expect(a.dominantFamily).toBe('FF-S03');
  });
  it('part A detects a family-mix difference', () => {
    const a = partA({ 'none@L2': ['FF-S03', 'FF-S03', 'FF-S03', 'FF-S01'], 'none@L3': ['FF-S03'], 'mcp@L2': ['FF-S01'] }, rf, 7 / 8, [['none@L2', 'mcp@L2']]);
    expect(a.pairs[0]?.pass).toBe(false);
    expect(a.uninformative).toBe(false);
  });
  it('r_f under F-RF: tp/(tp+fn); n = 0 takes the pooled rate', () => {
    const r = recallByFamily([{ ruleId: 'FF-S01', blocking: true, counts: { tp: 2, fn: 1 } }, { ruleId: 'FF-S03', blocking: true, counts: { tp: 3, fn: 0 } }, { ruleId: 'FF-P01', blocking: true, counts: { tp: 0, fn: 0 } }]);
    expect(r.rf['FF-S01']).toBeCloseTo(2 / 3, 10);
    expect(r.rf['FF-P01']).toBeCloseTo(5 / 6, 10);
  });
  it('part B: non-exempt sites only; the exempt share is reported beside it', () => {
    const site = (cell: Cell, snap: string, detected: boolean, exempt: boolean) => ({ cell, snapshotId: snap, file: exempt ? 'src/presentation/main.ts' : 'src/presentation/server.ts', detected, exempt });
    const sites = [site('none@L2', 'a', true, false), site('none@L2', 'a', false, true), site('mcp@L2', 'b', true, false), site('mcp@L2', 'c', true, false)];
    const b = partB(sites, [['none@L2', 'mcp@L2']], 1, 200);
    expect(b.cells.find((c) => c.cell === 'none@L2')?.rate).toBe(1);
    expect(b.cells.find((c) => c.cell === 'none@L2')?.exemptShare).toBe(0.5);
    expect(b.pass).toBe(true);
  });
});

describe('halves and the planted data set (D9)', () => {
  it('splits by replicate index', () => {
    const bs = [1, 2, 3, 4].map((r) => block(`t/rep${String(r)}`, 't', r, 1, 0, 0));
    const h = halves(bs);
    expect(h.first.map((b) => b.rep)).toEqual([1, 2]);
    expect(h.second.map((b) => b.rep)).toEqual([3, 4]);
  });
  it('a planted RR 0.25 at N = 40 is rejected for H1 and H2; the null is not', () => {
    const pilot = A2.map((b) => ({ D: b.D['none@L2'] as number, Y1: b.Y1 as number }));
    const eff = plantedBlocks(pilot, { tasks: 4, reps: 10, keep: { 'none@L3': 0.25, 'mcp@L2': 0.25 } });
    expect(eff).toHaveLength(40);
    const r = CONTRASTS.map((c) => analyseContrast(eff, c, { draws: 5000, resamples: 200 }));
    const d = familyDecision(r);
    expect(d.decisions.H1?.supportedUnderThisOutcome).toBe(true);
    expect(d.decisions.H2?.supportedUnderThisOutcome).toBe(true);
    const nul = plantedBlocks(pilot, { tasks: 4, reps: 10, keep: { 'none@L3': 1, 'mcp@L2': 1 }, nullRedraw: true });
    const n = familyDecision(CONTRASTS.map((c) => analyseContrast(nul, c, { draws: 5000, resamples: 200 })));
    expect(n.decisions.H1?.reject).toBe(false);
    expect(n.decisions.H2?.reject).toBe(false);
  });
});

describe('the committed 2a analysis output', () => {
  it('reproduces the 2a report §3 numbers', () => {
    const file = path.join(REPO, 'results/v1.4-study2b-prereg/analyse-2a/analysis.json');
    if (!fs.existsSync(file)) return;
    const a = JSON.parse(fs.readFileSync(file, 'utf8')) as { reproduction2a: { cells: { cell: string; D: number[]; meanInterval: { low: number; high: number } }[]; ratios: { cell: string; ratio: { estimate: number; low: number; high: number }; differenceCellMinusReference: { estimate: number; low: number; high: number } }[] } };
    const c = Object.fromEntries(a.reproduction2a.cells.map((x) => [x.cell, x]));
    expect(c['none@L2']?.D).toEqual([1, 0, 1, 3, 2, 2]);
    expect([c['none@L2']?.meanInterval.low, c['none@L2']?.meanInterval.high]).toEqual([0.5, 2]);
    expect([c['none@L3']?.meanInterval.low, c['none@L3']?.meanInterval.high]).toEqual([0, 1]);
    expect([c['mcp@L2']?.meanInterval.low, c['mcp@L2']?.meanInterval.high]).toEqual([0, 1]);
    const r = Object.fromEntries(a.reproduction2a.ratios.map((x) => [x.cell, x]));
    expect(r['none@L3']?.differenceCellMinusReference.low).toBe(-2);
    expect(r['none@L3']?.differenceCellMinusReference.high).toBe(0.5);
    expect([r['mcp@L2']?.ratio.low, r['mcp@L2']?.ratio.high]).toEqual([0, 1]);
  });
});

describe('D† helpers (finding 2)', () => {
  const ex = (f: string): boolean => /main\.ts$/.test(f);
  it('keeps presentation -> persistence pairs only, distinct, with the exempt flag', () => {
    const e = daggerEdges([
      { source: 'src/presentation/main.ts', target: 'src/persistence/r.ts', srcLayer: 'presentation', tgtLayer: 'persistence', relType: 'IMPORTS' },
      { source: 'src/presentation/main.ts', target: 'src/persistence/r.ts', srcLayer: 'presentation', tgtLayer: 'persistence', relType: 'RE_EXPORTS' },
      { source: 'src/presentation/server.ts', target: 'src/business/s.ts', srcLayer: 'presentation', tgtLayer: 'business' },
    ], ex);
    expect(e).toEqual([{ source: 'src/presentation/main.ts', target: 'src/persistence/r.ts', exemptSource: true }]);
  });
  it('lists renames of a non-exempt file to an exempt name only', () => {
    expect(renamesToExempt(new Map([['src/presentation/server.ts', 'src/presentation/main.ts'], ['a.ts', 'b.ts']]), ex)).toEqual([{ from: 'src/presentation/server.ts', to: 'src/presentation/main.ts' }]);
  });
  it('new edges of steps 2..k, first appearance', () => {
    const e1 = { source: 'p/a.ts', target: 'q/x.ts', exemptSource: false };
    const e2 = { source: 'p/main.ts', target: 'q/x.ts', exemptSource: true };
    expect(newEdgesByStep([{ step: 1, edges: [e1] }, { step: 2, edges: [e1, e2] }, { step: 3, edges: [e2] }])).toEqual([{ step: 2, edge: e2 }]);
  });
  it('flags a contrast whose exempt share differs by more than 0.20', () => {
    const a = cellEvasion('none@L2', [{ lastStepEdges: 4, lastStepExempt: 0, renamesToExempt: 0 }]);
    const b = cellEvasion('mcp@L2', [{ lastStepEdges: 4, lastStepExempt: 2, renamesToExempt: 1 }]);
    expect(evasionFlag(a, b).flagged).toBe(true);
    expect(evasionFlag(a, a).flagged).toBe(false);
  });
});
