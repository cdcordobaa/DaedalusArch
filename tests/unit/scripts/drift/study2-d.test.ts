/**
 * R3 and T-MC (U4 design §5): Study 2's D with Y1 (D-1 to D-8).
 * - R3: probe 1's D from the committed step records `results/v1.3-floor-probe/<task>/none/step-NN.json`, ρ empty.
 * - The D rules on hand-built runs: Y1 gating both ways, null propagation, `afterUnscored`, the `counted` predicate,
 *   D per new slice, inherited removal, renames under both policies, and the per-group split.
 * - T-MC: MEMO_COMPAT equals `runOutcomes().newBlockingTotal` of `scripts/lib/loop/pilot-metrics.ts` on hand-built step
 *   records, and the documented case where the S2D-01 key and the memo key differ.
 * Read-only, pure, no Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CLAUDE_CODE_ADAPTER_ID } from '../../../../scripts/lib/generators/types.js';
import { runOutcomes } from '../../../../scripts/lib/loop/pilot-metrics.js';
import { EMPTY_USAGE, type BlockingFinding, type StepRecord } from '../../../../scripts/lib/loop/types.js';
import {
  aggregateD, driftRun, fromProbeStepFile, fromStepRecord, y1Gate, type ProbeStepFile, type StepInput,
} from '../../../../scripts/lib/drift/study2-d.js';
import { D_CONSTRUCT, MEMO_COMPAT, STUDY2_S2D01, type DriftParams, type DriftRun, type IdFinding } from '../../../../scripts/lib/drift/types.js';
import { dep, snap } from './fixtures.js';

const PROBE = path.resolve(__dirname, '../../../../results/v1.3-floor-probe');
function probeRun(task: string): StepInput[] {
  const dir = path.join(PROBE, task, 'none');
  return fs.readdirSync(dir).filter((f) => /^step-\d+\.json$/.test(f)).sort().map((f) => {
    const s = fromProbeStepFile(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProbeStepFile);
    return s.step === 1 ? s : { ...s, rename: new Map() }; // ρ is empty for probe 1 (ID-9)
  });
}
const FINE: DriftParams = { ...STUDY2_S2D01, grain: 'fine' };

describe('R3: probe 1 D and Y1', () => {
  const cases = [
    { task: 'market-vendors', D: 1, Y1: 2, perStep: [0, 0, 1], Dfine: 2, Y1fine: 4, incomplete: true },
    { task: 'youth-league', D: 2, Y1: 2, perStep: [2, 0, 0, 0], Dfine: 2, Y1fine: 3, incomplete: false },
    { task: 'hive-health', D: 5, Y1: 4, perStep: [3, 2, 0, 0], Dfine: 7, Y1fine: 6, incomplete: false },
  ];
  it.each(cases)('$task: D = $D, Y1 = $Y1 under the edge key, final-snapshots', (c) => {
    const r = driftRun(probeRun(c.task), STUDY2_S2D01);
    expect(r.D).toBe(c.D);
    expect(r.Y1).toBe(c.Y1);
    expect(r.Y1fine).toBe(c.Y1fine);
    expect(r.perStep.map((p) => p.newCount)).toEqual(c.perStep);
    expect(r.incomplete).toBe(c.incomplete);
    expect(r.eligible).toBe(true);
    expect(r.renameMapMissing).toBe(false);
    expect(r.construct).toBe(D_CONSTRUCT);
    expect(r.params).toBe(STUDY2_S2D01);
  });
  it.each(cases)('$task: D = $Dfine under the fine key', (c) => {
    const r = driftRun(probeRun(c.task), FINE);
    expect(r.D).toBe(c.Dfine);
    expect(r.Y1).toBe(c.Y1fine);
  });
  it.each(['food-bank', 'garden-plots', 'shelter-adoptions'])('Hexagonal %s: Y1 = 0, D = 0, not eligible (the real Y1 = 0 falsifier)', (task) => {
    const r = driftRun(probeRun(task), STUDY2_S2D01);
    expect(r).toMatchObject({ Y1: 0, D: 0, eligible: false });
  });
});

const st = (step: number, findings: IdFinding[] | null, o: Partial<StepInput> = {}): StepInput => ({
  step, final: findings === null ? null : snap(`s${String(step)}`, findings), rename: new Map(), ...o,
});
const run = (D: number | null, Y1: number | null, blockId: string, cell: string, runId = `${blockId}-${cell}`): DriftRun => ({
  ...driftRun([st(1, [])], STUDY2_S2D01), D, Y1, eligible: Y1 === null ? null : Y1 >= 1, blockId, cell, runId,
});

describe('D rules (D-1 to D-7)', () => {
  const a = dep('src/p/a.ts', 'src/b/x.ts');
  const b = dep('src/p/b.ts', 'src/b/x.ts');
  const c = dep('src/p/c.ts', 'src/b/x.ts', 'FF-S03');
  it('a null step makes D null and the next step afterUnscored (D-7)', () => {
    const r = driftRun([st(1, [a]), st(2, null), st(3, [a, b])], STUDY2_S2D01);
    expect(r.D).toBeNull();
    expect(r.perStep).toEqual([{ step: 2, newCount: null }, { step: 3, newCount: 1, afterUnscored: true }]);
  });
  it('the counted predicate drops a finding (Study 2 passes the check-correct label)', () => {
    const r = driftRun([st(1, [a]), st(2, [a, b, c])], STUDY2_S2D01, (f) => f.functionId !== 'FF-S03');
    expect(r.D).toBe(1);
  });
  it('D per new slice is null without newSlices, and D / Σ slices with them; D per step and per KLOC', () => {
    expect(driftRun([st(1, [a]), st(2, [a, b])], STUDY2_S2D01).DperNewSlice).toBeNull();
    const r = driftRun([st(1, [a]), st(2, [a, b], { newSlices: 2, addedKloc: 0.5 }), st(3, [a, b, c], { newSlices: 2, addedKloc: 0.5 })], STUDY2_S2D01);
    expect(r).toMatchObject({ D: 2, DperNewSlice: 0.5, DperStep: 1, DperAddedKloc: 2, stepsToFirstNew: 1, Yk: 3 });
  });
  it('inherited removal, and D conditioned on no inherited removal', () => {
    const kept = driftRun([st(1, [a]), st(2, [a, b])], STUDY2_S2D01);
    expect(kept).toMatchObject({ inheritedRemoved: 0, DnoInheritedRemoval: 1 });
    const gone = driftRun([st(1, [a]), st(2, [b])], STUDY2_S2D01);
    expect(gone).toMatchObject({ inheritedRemoved: 1, DnoInheritedRemoval: null, D: 1 });
    expect(gone.inheritedRemovedPerStep).toEqual([{ step: 2, removed: 1 }]);
  });
  it("a rename between steps is not new under 'continue' and is new under 'end'", () => {
    const moved = dep('src/p/a2.ts', 'src/b/x.ts');
    const steps = [st(1, [a]), st(2, [moved], { rename: new Map([['src/p/a.ts', 'src/p/a2.ts']]) })];
    expect(driftRun(steps, STUDY2_S2D01).D).toBe(0);
    expect(driftRun(steps, { ...STUDY2_S2D01, renamePolicy: 'end' }).D).toBe(1);
  });
  it("a missing ρ under 'continue' is flagged, not treated as rename-free (D-2)", () => {
    expect(driftRun([st(1, [a]), { step: 2, final: snap('s2', [a]) }], STUDY2_S2D01).renameMapMissing).toBe(true);
  });
  it('per-group D and leave-one-group-out (D-6)', () => {
    const r = driftRun([st(1, [a]), st(2, [a, b, c])], STUDY2_S2D01, undefined, { runId: 'r', blockId: 'b', cell: 'none', groupBy: (f) => f.functionId });
    expect(r.byGroup).toEqual({ 'FF-S01': { D: 1, Dwithout: 1 }, 'FF-S03': { D: 1, Dwithout: 1 } });
  });
  it('Y1 = 0: not eligible; excluded under exclude, kept and flagged under report-only, counted in both (D-4)', () => {
    const runs = [run(3, 2, 'B1', 'none'), run(1, 2, 'B1', 'mcp'), run(0, 0, 'B2', 'none'), run(2, 0, 'B2', 'mcp')];
    const ex = aggregateD(runs, { conditionOnY1: 'exclude' });
    expect(ex).toMatchObject({ blocks: 2, y1ZeroBlocks: 1, ineligibleBlocks: 1, flagged: [], sumDByCell: { none: 3, mcp: 1 } });
    expect(ex.excluded.map((r) => r.runId)).toEqual(['B2-none', 'B2-mcp']);
    const ro = aggregateD(runs, { conditionOnY1: 'report-only' });
    expect(ro).toMatchObject({ y1ZeroBlocks: 1, flagged: ['B2-none', 'B2-mcp'], sumDByCell: { none: 3, mcp: 3 } });
    expect(ro.excluded).toEqual([]);
  });
  it('aggregateD throws on two cells of one block with different Y1 (the shared start is broken)', () => {
    expect(() => aggregateD([run(1, 2, 'B', 'none'), run(1, 3, 'B', 'mcp')], { conditionOnY1: 'exclude' })).toThrow(/unequal Y1/);
  });
  it('y1Gate at 4 of 6 (D-5)', () => {
    const six = [2, 1, 0, 3, 0, 1].map((y, i) => run(0, y, `B${String(i)}`, 'none'));
    expect(y1Gate(six, { minEligible: 4, ofRuns: 6, y1Min: 1 })).toEqual({ pass: true, eligible: 4, runs: 6, ofRuns: 6, minEligible: 4 });
    expect(y1Gate(six.slice(1), { minEligible: 4, ofRuns: 6, y1Min: 1 }).pass).toBe(false);
  });
});

// ── T-MC: MEMO_COMPAT against the registered memo outcome ──────────────────

const bf = (o: Partial<BlockingFinding> & { filePath: string }): BlockingFinding => ({ ruleId: 'FF-S01', ruleName: 'Layer dependency', template: 'layer-dependency', message: 'm', ...o });
const cycleF = (filePath: string, target: string, violationId: string): BlockingFinding => bf({ ruleId: 'FF-S02', ruleName: 'No cyclic dependencies', template: 'cyclic-dependency', filePath, target, violationId });
function turn(turnId: string, kind: 'step' | 'repair', findings: BlockingFinding[] | null): StepRecord['turns'][number] {
  return {
    turnId, kind, promptSha256: '0',
    result: { status: 'completed', usage: EMPTY_USAGE, wallMs: 1, attempts: [], interruptions: [], argv: [], envelopePath: null, permissionDenials: 0 },
    snapshot: {
      commit: turnId, sourceFiles: ['a.ts'], treeFileCount: 1, loc: 100, diff: { added: 0, modified: 0, deleted: 0 }, skeletonIntact: true, typecheck: null,
      evaluation: findings === null ? null : {
        scoringMode: 'v1.3', ahs: null, blockingAhs: null, verdict: findings.length > 0 ? 'fail' : 'pass', violationCount: findings.length,
        blockingViolationCount: findings.length, advisoryViolationCount: 0, blockingByRule: {}, advisoryByRule: {}, blockingFindings: findings, durationMs: 1,
      },
    },
  };
}
function stepRecord(stepIndex: number, turns: StepRecord['turns']): StepRecord {
  return {
    schema: 'loop-step/v1', runId: 'run-1', spec: { adapterId: CLAUDE_CODE_ADAPTER_ID, modelId: 'm', taskId: 't', arm: 'gate', runIndex: 0 },
    stepIndex, stepId: `s${String(stepIndex + 1)}`, startedAt: '', finishedAt: '', turns, repair: null, finalCommit: turns.at(-1)?.turnId ?? '',
    cost: { costUsd: null, inputTokens: null, outputTokens: null, wallMs: 1 },
  };
}

describe('T-MC: MEMO_COMPAT and the memo outcome (D-8)', () => {
  it('agree on a run with a repair turn that removes a finding a later step brings back', () => {
    const ab = bf({ filePath: 'src/a.ts', target: 'src/b.ts' });
    const cd = bf({ filePath: 'src/c.ts', target: 'src/d.ts' });
    const ef = bf({ filePath: 'src/e.ts', target: 'src/f.ts' });
    const gh = bf({ filePath: 'src/g.ts', target: 'src/h.ts' });
    const recs = [
      stepRecord(0, [turn('t1', 'step', [ab])]),
      stepRecord(1, [turn('t2', 'step', [ab, cd, ef]), turn('t2r', 'repair', [ab, cd])]),
      stepRecord(2, [turn('t3', 'step', [ab, cd, ef, gh])]),
    ];
    const memo = runOutcomes(recs);
    const d = driftRun(recs.map((r) => fromStepRecord(r)), MEMO_COMPAT);
    expect(memo.newBlockingTotal).toBe(2);
    expect(d.D).toBe(memo.newBlockingTotal);
    expect(d.perStep.map((p) => p.newCount)).toEqual(memo.newBlocking.map((s) => s.count));
    // Under final-snapshots the repaired-away e -> f counts as new at step 3: the two prior unions differ (Q4).
    expect(driftRun(recs.map((r) => fromStepRecord(r)), { ...MEMO_COMPAT, priorUnion: 'final-snapshots' }).D).toBe(3);
  });
  it('agree on an unscored step (null, never 0)', () => {
    const ab = bf({ filePath: 'src/a.ts', target: 'src/b.ts' });
    const recs = [stepRecord(0, [turn('t1', 'step', [ab])]), stepRecord(1, [turn('t2', 'step', null)]), stepRecord(2, [turn('t3', 'step', [ab])])];
    expect(runOutcomes(recs).newBlockingTotal).toBeNull();
    const d = driftRun(recs.map((r) => fromStepRecord(r)), MEMO_COMPAT);
    expect(d.D).toBeNull();
    expect(d.perStep[1]).toEqual({ step: 3, newCount: 0, afterUnscored: true });
  });
  it('differ on a cycle reported from another start node: the memo counts it new, the S2D-01 key does not', () => {
    const r1 = cycleF('src/x.ts', 'src/y.ts', 'c1');
    const r2 = cycleF('src/y.ts', 'src/z.ts', 'c2');
    const recs = [stepRecord(0, [turn('t1', 'step', [r1])]), stepRecord(1, [turn('t2', 'step', [r2])])];
    const reports = new Map<string, unknown[]>([
      ['t1', [{ id: 'c1', filePath: 'src/x.ts,src/y.ts,src/z.ts,src/x.ts' }]],
      ['t2', [{ id: 'c2', filePath: 'src/y.ts,src/z.ts,src/x.ts,src/y.ts' }]],
    ]);
    expect(runOutcomes(recs).newBlockingTotal).toBe(1);
    expect(driftRun(recs.map((r) => fromStepRecord(r, reports)), MEMO_COMPAT).D).toBe(1);
    const s2 = driftRun(recs.map((r) => ({ ...fromStepRecord(r, reports), rename: new Map() })), STUDY2_S2D01);
    expect(s2.D).toBe(0);
    expect(s2.degradedCycleKeys).toBe(0);
    // Without the report violations the S2D-01 key degrades to {filePath, target} and is flagged (ID-4).
    const degraded = driftRun(recs.map((r) => ({ ...fromStepRecord(r), rename: new Map() })), STUDY2_S2D01);
    expect(degraded.D).toBe(1);
    expect(degraded.degradedCycleKeys).toBe(2);
  });
});
