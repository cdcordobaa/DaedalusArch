/**
 * Study 2 analysis rehearsal: the checks that the analysis recovers what the synthetic generator planted. NOT A
 * PRE-REGISTRATION. Pure; no I/O.
 *
 * Estimands (from `SynthTruth`): per contrast, the conditional truth of the mean slope difference over the blocks
 * (each arm's expected OLS slope given its latent terms) and the planted relative reduction of the scenario.
 */
import { analyse, pilotSwitch } from './study2-analysis.js';
import type { AnalysisOptions, AnalysisReport, ContrastResult } from './study2-analysis.js';
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
      checks.push({ name: 'v1.3 format: the report says the defined fallback is NOT computable (no per-rule advisory counts)', pass: !report.primaryDefinitionMet && report.primaryNotes.some((n) => /NOT computable/.test(n)), detail: report.primaryNotes[0] ?? '' });
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
