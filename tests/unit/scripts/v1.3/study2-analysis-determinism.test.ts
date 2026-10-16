/**
 * Study 2 analysis determinism pack (A1; Docs/v1.3/study2-analysis-determinism.md; tooling, not a pre-registration):
 * exact sign-flip inference up to the plan's bound, the seed read from the plan, both blocking scales, the inference
 * field, the outcome columns (FF-S01/FF-S03 edge dedup, memo §3 identities), and OFF by default.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRng } from '../../../../scripts/lib/stats.js';
import type { BlockingFinding } from '../../../../scripts/lib/loop/types.js';
import {
  DEFAULT_OPTIONS, analyse, distinctEdges, parsePlan, pilotSwitch, runRows, signFlipTest,
} from '../../../../scripts/v1.3/lib/study2-analysis.js';
import type { AnalysisOptions, AnalysisPlan, LoadedRun } from '../../../../scripts/v1.3/lib/study2-analysis.js';
import { signFlipP } from '../../../../scripts/v1.3/lib/study2-power.js';
import { renderReport } from '../../../../scripts/v1.3/lib/study2-report.js';
import { PILOT_DESIGN, PLANNED_DESIGN, SCENARIOS, generateStudy } from '../../../../scripts/v1.3/lib/study2-synth.js';
import type { Scenario } from '../../../../scripts/v1.3/lib/study2-synth.js';

const PLAN_FILE = path.join(__dirname, '../../../../scripts/v1.3/study2-analysis-plan.json');
const scenario = (id: string): Scenario => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

describe('analysis plan file', () => {
  it('the committed plan parses, and leaves both author slots empty', () => {
    const plan = parsePlan(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')));
    expect(plan.primaryScale).toBeNull();
    expect(plan.confirmatoryInference).toBeNull();
    expect(plan.exactMaxUnits).toBe(20);
    expect(plan.seed).toBe(DEFAULT_OPTIONS.seed);
  });

  it('rejects a malformed plan', () => {
    const ok = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')) as Record<string, unknown>;
    expect(() => parsePlan({ ...ok, schema: 'x' })).toThrow(/schema/);
    expect(() => parsePlan({ ...ok, seed: 1.5 })).toThrow(/seed/);
    expect(() => parsePlan({ ...ok, exactMaxUnits: 30 })).toThrow(/exactMaxUnits/);
    expect(() => parsePlan({ ...ok, primaryScale: 'log' })).toThrow(/primaryScale/);
    expect(() => parsePlan({ ...ok, confirmatoryInference: 'vote' })).toThrow(/confirmatoryInference/);
  });
});

describe('sign-flip test', () => {
  const d = (n: number): number[] => Array.from({ length: n }, (_, i) => ((i * 37) % 11) - 4.5 + (i % 3) * 0.25);

  it('is exact (no randomness) up to the bound: the same p under any generator', () => {
    const ps = [1, 2, 3, 99, 20261016].map((s) => signFlipTest(d(18), 20, 999, createRng(s)));
    expect(new Set(ps.map((x) => x.p)).size).toBe(1);
    expect(ps[0]?.method).toBe('exact');
    expect(ps[0]?.mcSe).toBeNull();
  });

  it('agrees with the rehearsal test where that one is exact (≤ 14 units)', () => {
    for (const n of [1, 5, 10, 14]) expect(signFlipTest(d(n), 20, 999, createRng(1)).p).toBe(signFlipP(d(n), 999, createRng(1)));
  });

  it('above the bound: Monte Carlo, seeded, with its Monte Carlo SE', () => {
    const a = signFlipTest(d(22), 20, 1999, createRng(7));
    const b = signFlipTest(d(22), 20, 1999, createRng(7));
    expect(a).toEqual(b);
    expect(a.method).toBe('monte-carlo');
    expect(a.mcSe).toBeGreaterThan(0);
  });

  it('all-zero differences give p = 1 (the floor)', () => {
    expect(signFlipTest([0, 0, 0, 0], 20, 99, createRng(1)).p).toBe(1);
  });
});

const finding = (ruleId: string, filePath: string, target?: string): BlockingFinding => ({ ruleId, ruleName: ruleId, template: ruleId === 'FF-S03' ? 'no-layer-skip' : 'dependency-direction', filePath, ...(target !== undefined ? { target } : {}), message: 'm' });

describe('distinctViolatingEdges', () => {
  it('counts an edge scored by both FF-S01 and FF-S03 once, and keeps other rules and other edges', () => {
    const fs1 = [
      finding('FF-S01', 'src/p/a.ts', 'src/b/x.ts'),
      finding('FF-S03', 'src/p/a.ts', 'src/b/x.ts'),
      finding('FF-S03', 'src/p/a.ts', 'src/d/y.ts'),
      finding('FF-S01', 'src/b/x.ts', 'src/p/a.ts'),
      finding('FF-P01', 'src/p/a.ts', 'src/b/x.ts'),
      finding('FF-S03', 'src/q.ts'),
    ];
    const r = distinctEdges({ blockingViolationCount: 6, blockingFindings: fs1 });
    expect(r.count).toBe(5);
    expect(r.duplicatesByRule).toEqual({ 'FF-S03': 1 });
    expect(r.capped).toBe(false);
  });

  it('flags a capped listing (fewer listed than counted) and subtracts only the duplicates it can see', () => {
    const r = distinctEdges({ blockingViolationCount: 10, blockingFindings: [finding('FF-S01', 'a', 'b'), finding('FF-S03', 'a', 'b')] });
    expect(r.count).toBe(9);
    expect(r.capped).toBe(true);
  });
});

describe('outcome columns on hand-made records', () => {
  const base = generateStudy({ ...PILOT_DESIGN, tasks: 1, arms: ['none'] }, scenario('expected'), { seed: 3, evalFailureRate: 0 });
  const run0 = base.runs[0];
  if (run0 === undefined) throw new Error('no run');
  /** The run with each step's final snapshot holding exactly the given findings. */
  const withFindings = (perStep: readonly (readonly BlockingFinding[])[]): LoadedRun => ({
    run: run0.run,
    steps: run0.steps.map((s, i) => ({
      ...s,
      turns: s.turns.map((t, j) => {
        const ev = t.snapshot.evaluation;
        const fsx = j === s.turns.length - 1 ? perStep[i] ?? [] : [];
        return ev === null ? t : { ...t, snapshot: { ...t.snapshot, evaluation: { ...ev, blockingViolationCount: fsx.length, blockingFindings: fsx } } };
      }),
    })),
  });

  it('newIdentitiesFromStep2 counts identities first seen at step 2..k (lines ignored); edges dedup per step', () => {
    const e1 = finding('FF-S01', 'src/p/a.ts', 'src/b/x.ts');
    const e1s = finding('FF-S03', 'src/p/a.ts', 'src/b/x.ts');
    const e2 = finding('FF-S01', 'src/p/c.ts', 'src/b/x.ts');
    const steps = [[e1, e1s], [e1, e1s, { ...e2, line: 3 }], [e1, e1s, { ...e2, line: 9 }], [e1, e1s, e2, finding('FF-P01', 'z', 'w')]];
    const row = runRows([withFindings(steps)], { minStepsForSlope: 3 })[0];
    if (row === undefined) throw new Error('no row');
    // New after step 1: e2 (step 2) and the FF-P01 finding (step 4). Line changes do not make e2 new again.
    expect(row.metrics.newIdentitiesFromStep2).toBe(2);
    expect(row.steps.map((s) => s.identities)).toEqual([2, 3, 3, 4]);
    expect(row.steps.map((s) => s.distinctViolatingEdges)).toEqual([1, 2, 2, 3]);
    expect(row.steps.map((s) => s.blocking)).toEqual([2, 3, 3, 4]);
    expect(row.metrics.distinctViolatingEdgesSlope).toBeCloseTo(0.6);
  });

  it('a run with an unevaluated step has no newIdentitiesFromStep2', () => {
    const r = withFindings([[], [], [], []]);
    const broken: LoadedRun = { ...r, steps: r.steps.map((s, i) => (i === 1 ? { ...s, turns: s.turns.map((t) => ({ ...t, snapshot: { ...t.snapshot, evaluation: null } })) } : s)) };
    expect(runRows([broken], { minStepsForSlope: 3 })[0]?.metrics.newIdentitiesFromStep2).toBeNull();
  });
});

describe('analyse in plan mode (planned N, expected scenario)', () => {
  const plan: AnalysisPlan = { ...parsePlan(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'))), resamples: 199, flips: 999 };
  const s = scenario('expected');
  const study = generateStudy(PLANNED_DESIGN, s, { seed: 20261016 });
  const pilot = generateStudy(PILOT_DESIGN, s, { seed: 20261017, taskPrefix: 'synth-pilot-task-' });
  const decision = pilotSwitch(pilot.runs, null);
  const opts = (seed: number, extra: Partial<AnalysisOptions> = {}): AnalysisOptions => ({ ...DEFAULT_OPTIONS, alpha: plan.alpha, resamples: plan.resamples, flips: plan.flips, seed, plan, ...extra });
  const reps = [plan.seed, plan.seed + 1, plan.seed + 2].map((seed) => analyse(study.runs, study.schedule.runs, decision, opts(seed)));

  it('per-model contrasts (18 blocks) and task-level tests (6 tasks) are exact: identical p across seeds', () => {
    const perModel = reps.map((r) => r.perModel.flatMap((m) => m.contrasts.map((c) => c.p)));
    const task = reps.map((r) => r.confirmatory.map((c) => c.taskLevelP));
    expect(perModel[1]).toEqual(perModel[0]);
    expect(perModel[2]).toEqual(perModel[0]);
    expect(task[1]).toEqual(task[0]);
    expect(reps[0]?.perModel[0]?.contrasts[0]?.inference?.test.method).toBe('exact sign-flip');
  });

  it('54 blocks: Monte Carlo with the seed recorded, and the plan seed reproduces itself', () => {
    const c = reps[0]?.confirmatory[0];
    expect(c?.inference?.test.method).toBe('Monte Carlo sign-flip');
    expect(c?.inference?.test.seed).not.toBeNull();
    expect(c?.inference?.seedSource).toBe('plan');
    const again = analyse(study.runs, study.schedule.runs, decision, opts(plan.seed));
    expect(JSON.stringify(again)).toBe(JSON.stringify(reps[0]));
    expect(reps[1]?.confirmatory[0]?.inference?.seedSource).toBe('cli-override');
  });

  it('the test p does not depend on the number of bootstrap resamples', () => {
    const a = analyse(study.runs, study.schedule.runs, decision, opts(plan.seed, { resamples: 99, primaryOnly: true }));
    const b = analyse(study.runs, study.schedule.runs, decision, opts(plan.seed, { resamples: 299, primaryOnly: true }));
    expect(a.confirmatory.map((c) => c.p)).toEqual(b.confirmatory.map((c) => c.p));
  });

  it('both scales side by side, T2 on raw while the slot is unfilled, disagreement flag per contrast', () => {
    const r = reps[0];
    expect(r?.plan?.scales.map((x) => x.scale)).toEqual(['raw', 'perKloc']);
    expect(r?.plan?.primaryScaleSlotFilled).toBe(false);
    expect(r?.primaryMetric).toBe('blockingSlope');
    expect(r?.confirmatory).toEqual(r?.plan?.scales[0]?.contrasts);
    for (const c of r?.confirmatory ?? []) expect(c.inference?.disagreement).toBe(c.inference?.bootstrapRejects !== c.inference?.signFlipRejects);
    const filled = analyse(study.runs, study.schedule.runs, decision, opts(plan.seed, { plan: { ...plan, primaryScale: 'perKloc' }, primaryOnly: true }));
    expect(filled.primaryMetric).toBe('blockingPerKlocSlope');
    expect(filled.confirmatory).toEqual(filled.plan?.scales[1]?.contrasts);
  });

  it('every table caption carries outcome, scale, inference and seed; a CLI seed is flagged', () => {
    const md = renderReport(reps[0] ?? (undefined as never), 't');
    const tables = md.split('\n').filter((l) => /^#{2,3} T\d/.test(l)).length;
    const captions = md.split('\n').filter((l) => /^\*Outcome: .* · scale: .* · inference: .* · seed \d+ \(plan\)\.\*$/.test(l)).length;
    expect(captions).toBe(tables);
    expect(md).toContain('UNFILLED (A3)');
    expect(renderReport(reps[1] ?? (undefined as never), 't')).toContain('CLI override, not the plan seed');
  });

  it('--outcome adds T12 with the step-1 level apart', () => {
    const r = analyse(study.runs, study.schedule.runs, decision, opts(plan.seed, { primaryOnly: true, outcomes: ['blockingCount', 'distinctViolatingEdges', 'newIdentitiesFromStep2'] }));
    expect(r.outcomeColumns?.map((x) => x.outcome)).toEqual(['blockingCount', 'distinctViolatingEdges', 'newIdentitiesFromStep2']);
    // blockingCount is T2's raw blocking slope: the very same contrasts, not a second draw with other seeds.
    expect(r.outcomeColumns?.[0]?.contrasts).toEqual(r.confirmatory);
    for (const oc of r.outcomeColumns ?? []) for (const c of oc.contrasts) expect(typeof c.p).toBe('number');
    expect(r.outcomeColumns?.[0]?.step1Level.map((x) => x.arm)).toEqual(r.arms);
  });
});

describe('OFF by default', () => {
  it('without a plan or outcomes the report has no plan, inference or outcome fields', () => {
    const s = scenario('null');
    const study = generateStudy({ ...PLANNED_DESIGN, tasks: 2 }, s, { seed: 1 });
    const pilot = generateStudy(PILOT_DESIGN, s, { seed: 2, taskPrefix: 'synth-pilot-task-' });
    const r = analyse(study.runs, study.schedule.runs, pilotSwitch(pilot.runs, null), { ...DEFAULT_OPTIONS, resamples: 99, flips: 99 });
    const json = JSON.stringify(r);
    expect(json).not.toContain('"inference"');
    expect(json).not.toContain('"plan"');
    expect(json).not.toContain('"outcomeColumns"');
    expect(renderReport(r, 't')).not.toContain('*Outcome:');
  });
});
