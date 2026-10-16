/**
 * Study 2 analysis rehearsal: the checks that the analysis recovers what the synthetic generator planted. NOT A
 * PRE-REGISTRATION. Pure; no I/O.
 *
 * Estimands (from `SynthTruth`): per contrast, the conditional truth of the mean slope difference over the blocks
 * (each arm's expected OLS slope given its latent terms) and the planted relative reduction of the scenario.
 */
import { analyse, pilotSwitch } from './study2-analysis.js';
import type { AnalysisOptions, AnalysisReport, ContrastResult, LoadedRun, SwitchDecision } from './study2-analysis.js';
import { PILOT_DESIGN, PLANNED_DESIGN, generateStudy } from './study2-synth.js';
import type { Scenario, SynthTruth } from './study2-synth.js';

export interface Check {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

const inCi = (v: number, c: { low: number | null; high: number | null }): boolean => c.low !== null && c.high !== null && v >= c.low && v <= c.high;
const r3 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));

export function truthDiff(truth: SynthTruth, arm: string, ref: string, outcome: 'blocking' | 'advisory'): number {
  const d = truth.blocks.map((b) => {
    const s = outcome === 'blocking' ? b.blockingSlope : b.advisorySlope;
    return (s[arm] ?? 0) - (s[ref] ?? 0);
  });
  return d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
}

export function plantedReduction(truth: SynthTruth, arm: string, outcome: 'blocking' | 'advisory'): number {
  const e = arm === 'gate' ? truth.scenario.effects.gate : arm === 'daedalus-mcp' ? truth.scenario.effects.mcp : 0;
  return outcome === 'advisory' ? e * truth.assumptions.advisorySpillover : e;
}

function contrastChecks(c: ContrastResult, truth: SynthTruth, outcome: 'blocking' | 'advisory', expectEffect: boolean): Check[] {
  const t = truthDiff(truth, c.arm, c.reference, outcome);
  const planted = plantedReduction(truth, c.arm, outcome);
  const name = `${c.arm} − ${c.reference}`;
  const out: Check[] = [
    { name: `${name}: 95% CI of the mean slope difference covers the generating value`, pass: inCi(t, c.ci), detail: `truth ${r3(t)}, estimate ${r3(c.meanDiff)}, CI [${r3(c.ci.low)}, ${r3(c.ci.high)}]` },
  ];
  if (expectEffect) {
    out.push({ name: `${name}: estimate has the planted sign (less erosion)`, pass: (c.meanDiff ?? 0) < 0, detail: `estimate ${r3(c.meanDiff)}` });
    out.push({ name: `${name}: 95% CI of the relative reduction covers the planted reduction`, pass: inCi(planted, c.relativeReductionCi), detail: `planted ${r3(planted)}, estimate ${r3(c.relativeReduction)}, CI [${r3(c.relativeReductionCi.low)}, ${r3(c.relativeReductionCi.high)}]` });
  }
  return out;
}

export function scenarioChecks(scenario: Scenario, report: AnalysisReport, truth: SynthTruth, advisoryByRule: boolean): Check[] {
  const checks: Check[] = [];
  if (scenario.floor) {
    checks.push({ name: 'switch rule: pilot primary outcome is zero → pre-committed fallback triggered', pass: report.switch.fallbackTriggered && report.switch.erosion === false, detail: report.switch.statement });
    checks.push({ name: 'primary outcome moved to the advisory-tier erosion rate', pass: report.primaryMetric === (advisoryByRule ? 'advisoryExclCv05PerKlocSlope' : 'advisoryTotalPerKlocSlope'), detail: report.primaryMetric });
    checks.push({ name: 'the report says so (statement names the fallback)', pass: /PRE-COMMITTED FALLBACK/.test(report.switch.statement), detail: 'T1 of report.md' });
    if (advisoryByRule) {
      checks.push({ name: 'fallback outcome computed as defined (FF-CV05 excluded)', pass: report.primaryDefinitionMet, detail: 'advisoryByRule present on every evaluated step' });
      for (const c of report.confirmatory) checks.push(...contrastChecks(c, truth, 'advisory', false));
    } else {
      checks.push({ name: 'pre-#142 records: the report says the defined fallback is NOT computable (no per-rule advisory counts)', pass: !report.primaryDefinitionMet && report.primaryNotes.some((n) => /NOT computable/.test(n)), detail: report.primaryNotes[0] ?? '' });
    }
    return checks;
  }
  checks.push({ name: 'switch rule: pilot shows erosion → primary stays blocking', pass: !report.switch.fallbackTriggered && report.primaryMetric === 'blockingSlope', detail: report.switch.statement });
  const nullScenario = scenario.effects.gate === 0 && scenario.effects.mcp === 0;
  if (nullScenario) {
    checks.push({ name: 'null: no confirmatory contrast rejected under Holm', pass: report.confirmatory.every((c) => c.holmReject !== true), detail: report.confirmatory.map((c) => `${c.arm}: Holm p ${r3(c.holmP ?? null)}`).join('; ') });
    for (const c of report.confirmatory) checks.push({ name: `null: ${c.arm} − ${c.reference} CI contains 0`, pass: inCi(0, c.ci), detail: `CI [${r3(c.ci.low)}, ${r3(c.ci.high)}]` });
  }
  for (const c of report.confirmatory) checks.push(...contrastChecks(c, truth, 'blocking', !nullScenario));
  return checks;
}

// ── Calibration: the whole pipeline over many seeds (in memory) ──────────────

export interface CalibrationRow {
  readonly scenario: string;
  readonly sims: number;
  readonly rejectGate: number;
  readonly rejectMcp: number;
  readonly coverGate: number;
  readonly coverMcp: number;
  readonly coverRelGate: number;
  readonly meanEstGate: number;
  readonly meanTruthGate: number;
  readonly signFlipVsBootstrapDisagree: number;
}

export function calibrate(scenario: Scenario, sims: number, seed: number, o: AnalysisOptions): CalibrationRow {
  let rg = 0;
  let rm = 0;
  let cg = 0;
  let cm = 0;
  let crg = 0;
  let eg = 0;
  let tg = 0;
  let dis = 0;
  for (let i = 0; i < sims; i++) {
    const s = seed + 1000 * i;
    const study = generateStudy(PLANNED_DESIGN, scenario, { seed: s });
    const pilot = generateStudy(PILOT_DESIGN, scenario, { seed: s + 1, taskPrefix: 'synth-pilot-task-' });
    const rep = analyse(study.runs, study.schedule.runs, pilotSwitch(pilot.runs, null), { ...o, seed: s, primaryOnly: true });
    const g = rep.confirmatory.find((c) => c.arm === 'gate');
    const m = rep.confirmatory.find((c) => c.arm === 'daedalus-mcp');
    if (g === undefined || m === undefined) continue;
    if (g.holmReject === true) rg++;
    if (m.holmReject === true) rm++;
    const outcome = scenario.floor ? 'advisory' : 'blocking';
    const t = truthDiff(study.truth, 'gate', 'none', outcome);
    if (inCi(t, g.ci)) cg++;
    if (inCi(truthDiff(study.truth, 'daedalus-mcp', 'none', outcome), m.ci)) cm++;
    if (inCi(plantedReduction(study.truth, 'gate', outcome), g.relativeReductionCi)) crg++;
    eg += g.meanDiff ?? 0;
    tg += t;
    const bootExcludes0 = !inCi(0, g.ci);
    if (bootExcludes0 !== ((g.p ?? 1) <= o.alpha)) dis++;
  }
  return { scenario: scenario.id, sims, rejectGate: rg / sims, rejectMcp: rm / sims, coverGate: cg / sims, coverMcp: cm / sims, coverRelGate: crg / sims, meanEstGate: eg / sims, meanTruthGate: tg / sims, signFlipVsBootstrapDisagree: dis / sims };
}

// ── Determinism pack (A1): calibration per scale and inference method, and seed stability ──

export interface PlanCalibrationRow {
  readonly scenario: string;
  /** `raw` / `perKloc` (blocking branch) or `advisory` (the floor's fallback scale, per KLOC). */
  readonly scale: string;
  readonly sims: number;
  readonly arms: readonly {
    readonly arm: string;
    /** Rejection rate of the Holm sign-flip test. */
    readonly signFlipHolm: number;
    /** Rejection rate of the unadjusted sign-flip test (p ≤ α). */
    readonly signFlipUnadjusted: number;
    /** Rate at which the two-stage bootstrap 95% CI excludes 0. */
    readonly bootstrap: number;
    /** Rate at which the bootstrap CI and the unadjusted p disagree. */
    readonly disagree: number;
    readonly cover: number;
  }[];
}

/** The calibration of `calibrate`, in plan mode, per scale and per inference method. `o.plan` must be set. */
export function calibratePlan(scenario: Scenario, sims: number, seed: number, o: AnalysisOptions): PlanCalibrationRow[] {
  if (o.plan === undefined) throw new Error('calibratePlan needs o.plan');
  const acc = new Map<string, Map<string, { h: number; u: number; b: number; d: number; c: number }>>();
  const outcome = scenario.floor ? 'advisory' : 'blocking';
  for (let i = 0; i < sims; i++) {
    const s = seed + 1000 * i;
    const study = generateStudy(PLANNED_DESIGN, scenario, { seed: s });
    const pilot = generateStudy(PILOT_DESIGN, scenario, { seed: s + 1, taskPrefix: 'synth-pilot-task-' });
    const rep = analyse(study.runs, study.schedule.runs, pilotSwitch(pilot.runs, null), { ...o, seed: s, seedSource: 'cli-override', primaryOnly: true });
    const sets: { scale: string; cs: readonly ContrastResult[] }[] = rep.plan !== undefined && rep.plan.scales.length > 0 ? rep.plan.scales.map((x) => ({ scale: x.scale, cs: x.contrasts })) : [{ scale: 'advisory', cs: rep.confirmatory }];
    for (const { scale, cs } of sets) {
      const m = acc.get(scale) ?? new Map<string, { h: number; u: number; b: number; d: number; c: number }>();
      acc.set(scale, m);
      for (const c of cs) {
        const a = m.get(c.arm) ?? { h: 0, u: 0, b: 0, d: 0, c: 0 };
        m.set(c.arm, a);
        if (c.holmReject === true) a.h++;
        if (c.inference?.signFlipRejects === true) a.u++;
        if (c.inference?.bootstrapRejects === true) a.b++;
        if (c.inference?.disagreement === true) a.d++;
        // Coverage of the generating value; the per-KLOC truth is not in SynthTruth, so only the raw scale has it.
        if (scale !== 'perKloc' && inCi(truthDiff(study.truth, c.arm, c.reference, outcome), c.ci)) a.c++;
      }
    }
  }
  return [...acc.entries()].map(([scale, m]) => ({
    scenario: scenario.id, scale, sims,
    arms: [...m.entries()].map(([arm, a]) => ({ arm, signFlipHolm: a.h / sims, signFlipUnadjusted: a.u / sims, bootstrap: a.b / sims, disagree: a.d / sims, cover: scale === 'perKloc' ? Number.NaN : a.c / sims })),
  }));
}

export interface StabilityRow {
  readonly scope: string;
  readonly contrast: string;
  readonly units: number;
  readonly method: string;
  readonly seeds: number;
  readonly pMin: number | null;
  readonly pMax: number | null;
  readonly identical: boolean;
  readonly rejects: number;
}

/**
 * The same data analysed under `seeds.length` different seeds (plan mode): per contrast, the range of p and whether
 * every seed gives the same p. Scopes: T2b (both scales, Holm decision), T5 (per model), T3 (task level).
 */
export function seedStability(runs: readonly LoadedRun[], scheduled: readonly string[], decision: SwitchDecision, o: AnalysisOptions, seeds: readonly number[]): StabilityRow[] {
  const reps = seeds.map((seed) => analyse(runs, scheduled, decision, { ...o, seed, seedSource: seed === o.plan?.seed ? 'plan' : 'cli-override' }));
  const rows = new Map<string, { scope: string; contrast: string; units: number; method: string; ps: (number | null)[]; rejects: number }>();
  const add = (scope: string, c: ContrastResult, p: number | null, units: number, method: string, reject: boolean): void => {
    const key = `${scope}|${c.arm}-${c.reference}`;
    const r = rows.get(key) ?? { scope, contrast: `${c.arm} − ${c.reference}`, units, method, ps: [], rejects: 0 };
    rows.set(key, r);
    r.ps.push(p);
    if (reject) r.rejects++;
  };
  for (const rep of reps) {
    const sets = rep.plan !== undefined && rep.plan.scales.length > 0 ? rep.plan.scales.map((x) => ({ s: `T2b ${x.scale} (Holm)`, cs: x.contrasts })) : [{ s: 'T2 (Holm)', cs: rep.confirmatory }];
    for (const { s, cs } of sets) for (const c of cs) add(s, c, c.p, c.blocks, c.inference?.test.method ?? 'sign-flip', c.holmReject === true);
    for (const c of rep.confirmatory) add('T3 task level', c, c.taskLevelP, c.tasks, c.inference?.taskLevelTest.method ?? 'sign-flip', (c.taskLevelP ?? 1) <= o.alpha);
    for (const m of rep.perModel) for (const c of m.contrasts) add(`T5 ${m.model}`, c, c.p, c.blocks, c.inference?.test.method ?? 'sign-flip', (c.p ?? 1) <= o.alpha);
  }
  return [...rows.values()].map((r) => {
    const ps = r.ps.filter((x): x is number => x !== null);
    return { scope: r.scope, contrast: r.contrast, units: r.units, method: r.method, seeds: seeds.length, pMin: ps.length === 0 ? null : Math.min(...ps), pMax: ps.length === 0 ? null : Math.max(...ps), identical: ps.length === r.ps.length && ps.every((p) => p === ps[0]), rejects: r.rejects };
  });
}
