/**
 * Study 2 analysis rehearsal (not a pre-registration): the synthetic generator writes exactly what the loop harness
 * writes, the harness reader reads it back, and the analysis recovers the planted effects, reports a null under no
 * effect and triggers the memo's pre-committed fallback under the floor.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runLoop } from '../../../../scripts/lib/loop/loop.js';
import type { StepRecord } from '../../../../scripts/lib/loop/types.js';
import {
  DEFAULT_OPTIONS, analyse, auc, findingIdentity, holmAdjust, ols, overrideSwitch, pilotSwitch, runRows,
} from '../../../../scripts/v1.3/lib/study2-analysis.js';
import type { FindingLabel, LoadedRun } from '../../../../scripts/v1.3/lib/study2-analysis.js';
import { loadOutRoot, writeOutRoot } from '../../../../scripts/v1.3/lib/study2-io.js';
import { scenarioChecks } from '../../../../scripts/v1.3/lib/study2-rehearsal.js';
import { forestSvg, renderReport, trajectorySvg } from '../../../../scripts/v1.3/lib/study2-report.js';
import { PILOT_DESIGN, PLANNED_DESIGN, SCENARIOS, generateStudy } from '../../../../scripts/v1.3/lib/study2-synth.js';
import type { Scenario } from '../../../../scripts/v1.3/lib/study2-synth.js';
import { context, spec, tmpRoot } from '../loop/helpers.js';

const OPTS = { ...DEFAULT_OPTIONS, resamples: 999, flips: 1999 };
const scenario = (id: string): Scenario => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

/** Every key path of a JSON value with its value type ("a.b[].c": "number"). Empty arrays contribute no element path. */
function shape(v: unknown, at = '', out = new Map<string, Set<string>>()): Map<string, Set<string>> {
  const add = (p: string, t: string): void => {
    out.set(p, (out.get(p) ?? new Set()).add(t));
  };
  if (Array.isArray(v)) {
    add(at, 'array');
    for (const x of v) shape(x, `${at}[]`, out);
  } else if (v !== null && typeof v === 'object') {
    add(at, 'object');
    // Rule-keyed maps: the key is data (a rule id), not a field.
    const map = /(?:ByRule)$/.test(at);
    for (const [k, x] of Object.entries(v)) shape(x, at === '' ? k : `${at}.${map ? '<rule>' : k}`, out);
  } else add(at, v === null ? 'null' : typeof v);
  return out;
}

function merged(records: readonly unknown[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of records) shape(r, '', m);
  return m;
}

describe('format: the synthetic records are the harness records', () => {
  const harness: StepRecord[] = [];
  let harnessRun: unknown;
  let harnessSchedule: unknown;
  beforeAll(async () => {
    const root = tmpRoot('s2-conf-');
    for (const arm of ['none', 'gate', 'daedalus-mcp'] as const) {
      const r = await runLoop(context(root), spec(arm));
      if (!r.success || r.data.kind !== 'completed') throw new Error('dry run failed');
      harness.push(...r.data.steps);
    }
    harnessRun = JSON.parse(fs.readFileSync(path.join(root, 'runs', 'claude-code-cli', 'stub-model', 'todo-list', 'gate', 'run-0', 'run.json'), 'utf8'));
    harnessSchedule = { schema: 'loop-schedule/v1', planSha256: 'x', tasksSha256: 'y', dryRun: true, runs: ['a'] };
  });

  it('the step records have the same key paths and value types as a harness dry run', () => {
    // #142 (merged into v1.3) made `advisoryByRule` part of the harness step record, so compare with it on.
    const synth = generateStudy({ ...PLANNED_DESIGN, tasks: 2, replicates: 1 }, scenario('expected'), { seed: 3, evalFailureRate: 0, advisoryByRule: true });
    const s = merged(synth.runs.flatMap((r) => r.steps));
    const h = merged(harness);
    // Paths the dry run cannot show: the stub type-check never reports a code; the stub costs are never null; the stub
    // evaluator's advisoryByRule is empty in this dry run (no advisory row), so it has no <rule> key.
    const onlyInSynth = new Set(['turns[].snapshot.typecheck.codes[]', 'turns[].snapshot.evaluation.advisoryByRule.<rule>']);
    for (const [p, types] of s) {
      if (onlyInSynth.has(p)) continue;
      expect([p, h.has(p)]).toEqual([p, true]);
      for (const t of types) if (t !== 'null') expect([p, t, h.get(p)?.has(t)]).toEqual([p, t, true]);
    }
    for (const p of h.keys()) expect([p, s.has(p)]).toEqual([p, true]);
    expect([...merged(synth.runs.map((r) => r.run)).keys()].sort()).toEqual([...merged([harnessRun]).keys()].sort());
    expect([...merged([synth.schedule]).keys()].sort()).toEqual([...merged([harnessSchedule]).keys()].sort());
  });

  it('a failed evaluation is recorded as the harness records it (evaluation null, evaluationError set)', () => {
    const synth = generateStudy({ ...PLANNED_DESIGN, tasks: 2, replicates: 1 }, scenario('expected'), { seed: 4, evalFailureRate: 0.5 });
    const failed = synth.runs.flatMap((r) => r.steps).flatMap((s) => s.turns).filter((t) => t.snapshot.evaluation === null);
    expect(failed.length).toBeGreaterThan(0);
    for (const t of failed) expect(t.snapshot.evaluationError?.code).toBe('EVAL_SYNTH_FAILURE');
  });

  it('is deterministic for a seed, marks itself synthetic and keeps advisoryByRule off by default', () => {
    const a = generateStudy(PILOT_DESIGN, scenario('null'), { seed: 9 });
    const b = generateStudy(PILOT_DESIGN, scenario('null'), { seed: 9 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.runs.every((r) => r.run.dryRun && r.run.spec.modelId.startsWith('synth-'))).toBe(true);
    expect(a.runs.flatMap((r) => r.steps).flatMap((s) => s.turns).some((t) => t.snapshot.evaluation !== null && 'advisoryByRule' in t.snapshot.evaluation)).toBe(false);
  });

  it('round-trips through the harness reader', () => {
    const root = tmpRoot('s2-rt-');
    const synth = generateStudy(PILOT_DESIGN, scenario('expected'), { seed: 5 });
    writeOutRoot(path.join(root, 'o'), synth);
    const back = loadOutRoot(path.join(root, 'o'));
    expect(back.missingRuns).toEqual([]);
    expect(back.scheduled).toEqual(synth.schedule.runs);
    const byId = (rs: readonly LoadedRun[]) => JSON.stringify([...rs].sort((x, y) => x.run.runId.localeCompare(y.run.runId)));
    expect(byId(back.runs)).toBe(byId(synth.runs));
    expect(() => {
      writeOutRoot(path.join(root, 'o'), synth);
    }).toThrow(/not empty/);
  });
});

describe('analysis building blocks', () => {
  it('ols, auc and Holm', () => {
    expect(ols([[1, 1], [2, 2], [4, 4]])).toBeCloseTo(1);
    expect(ols([[1, 3]])).toBeNull();
    expect(auc([[1, 0], [2, 1], [3, 1]])).toBeCloseTo(0.75);
    expect(holmAdjust([0.01, 0.04, null])).toEqual([0.02, 0.04, null]);
    expect(holmAdjust([0.03, 0.02])).toEqual([0.04, 0.04]);
  });

  it('a step without an outcome is left out of the slope; too few steps leave the slope undefined', () => {
    const synth = generateStudy({ ...PLANNED_DESIGN, tasks: 1, replicates: 1 }, scenario('expected'), { seed: 2, evalFailureRate: 0 });
    const run = synth.runs[0];
    if (run === undefined) throw new Error('no run');
    const drop = (keep: number): LoadedRun => ({
      run: run.run,
      steps: run.steps.map((s, i) => (i < keep ? s : { ...s, turns: s.turns.map((t) => ({ ...t, snapshot: { ...t.snapshot, evaluation: null } })) })),
    });
    expect(runRows([drop(5)], OPTS)[0]?.metrics.blockingSlope).not.toBeNull();
    expect(runRows([drop(3)], OPTS)[0]?.stepsWithOutcome).toBe(3);
    expect(runRows([drop(2)], OPTS)[0]?.metrics.blockingSlope).toBeNull();
  });

  it('pilot switch rule: new identities after step 1 in none, labels filter, lines ignored', () => {
    const pilot = generateStudy(PILOT_DESIGN, scenario('expected'), { seed: 11, evalFailureRate: 0 });
    const d = pilotSwitch(pilot.runs, null);
    expect(d.provisional).toBe(true);
    // Synthetic identities persist by index, so a run's new findings after step 1 number max(Y_1..Y_k) − Y_1.
    const counts = (r: LoadedRun): number[] => r.steps.map((s) => s.turns[s.turns.length - 1]?.snapshot.evaluation?.blockingViolationCount ?? 0);
    const none = pilot.runs.filter((x) => x.run.spec.arm === 'none');
    const expected = none.reduce((a, r) => a + Math.max(...counts(r)) - (counts(r)[0] ?? 0), 0);
    expect(d.perTask.reduce((a, t) => a + t.newBlockingAfterStep1, 0)).toBe(expected);
    const ids = new Set(none.flatMap((r) => r.steps.flatMap((s) => s.turns.flatMap((t) => t.snapshot.evaluation?.blockingFindings.map(findingIdentity) ?? []))));
    const allIncorrect = new Map<string, FindingLabel>([...ids].map((i) => [i, 'incorrect']));
    const e = pilotSwitch(pilot.runs, allIncorrect);
    expect(e.erosion).toBe(false);
    expect(e.fallbackTriggered).toBe(true);
    expect(e.perTask.reduce((a, t) => a + t.excludedByLabel, 0)).toBe(expected);
    expect(overrideSwitch('blocking', 'test').statement).toMatch(/NOT applied/);
  });
});

describe('rehearsal scenarios at the planned N (seed 20261016)', () => {
  const memo = new Map<string, { report: ReturnType<typeof analyse>; checks: ReturnType<typeof scenarioChecks> }>();
  const run = (id: string, byRule: boolean) => {
    const key = `${id}:${String(byRule)}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const s = scenario(id);
    const study = generateStudy(PLANNED_DESIGN, s, { seed: 20261016, advisoryByRule: byRule });
    const pilot = generateStudy(PILOT_DESIGN, s, { seed: 20261017, advisoryByRule: byRule, taskPrefix: 'synth-pilot-task-' });
    const report = analyse(study.runs, study.schedule.runs, pilotSwitch(pilot.runs, null), { ...OPTS, seed: 20261016 });
    const out = { report, checks: scenarioChecks(s, report, study.truth, byRule) };
    memo.set(key, out);
    return out;
  };

  it.each([['null', false], ['small', false], ['expected', false], ['floor', false], ['floor', true]] as const)('%s (advisoryByRule %s): every check passes', (id, byRule) => {
    const { checks, report } = run(id, byRule);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
    expect(report.confirmatory.map((c) => c.blocks)).toEqual([54, 54]);
  });

  it('renders every table and figure', () => {
    const { report } = run('expected', false);
    const md = renderReport(report, 't');
    for (const h of ['T0.', 'T1.', 'T2.', 'T3.', 'T4.', 'T5.', 'T6.', 'T7.', 'T8.', 'T9.', 'T10.', 'T11.', 'Not computable']) expect(md).toContain(h);
    expect(md).toContain('SYNTHETIC');
    expect(trajectorySvg(report.trajectories.primary, 'y', 't')).toMatch(/^<svg[\s\S]*<\/svg>\n$/);
    const c = report.confirmatory[0];
    if (c === undefined) throw new Error('no contrast');
    expect(forestSvg(c, 't')).toContain('Pooled');
  });

  it('floor: the report states the fallback and, in the v1.3 format, that its definition cannot be met', () => {
    const { report } = run('floor', false);
    expect(report.switch.fallbackTriggered).toBe(true);
    expect(renderReport(report, 't')).toMatch(/PRE-COMMITTED FALLBACK[\s\S]*Memo definition met on these records:\*\* NO/);
    expect(report.repair?.failingSteps).toBe(0);
  });
});
