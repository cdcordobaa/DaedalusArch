/**
 * Study 2 analysis rehearsal, end to end: for each of the four scenarios, write a synthetic out-root in the harness
 * format, read it back from disk, run the analysis, check what it recovers, and write the tables and figures; then
 * the power at the planned N from the power simulation, and a calibration of the whole pipeline over many seeds.
 * NOT DATA, NOT A PRE-REGISTRATION. Entry file: no exports. Reading: Docs/v1.3/study2-analysis-rehearsal.md.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-rehearsal.ts --data-root <scratch dir> --out results/v1.3-study2-rehearsal
 *     [--seed 20261016] [--calibration-sims 200] [--power-sims 400]
 *     [--plan scripts/v1.3/study2-analysis-plan.json [--outcome <list>] [--stability-seeds 10]]
 * `--plan` (OFF by default; Docs/v1.3/study2-analysis-determinism.md) analyses every scenario in plan mode, calibrates
 * per scale and per inference method, and adds the "decision stability across seeds" table. Without it the output is
 * the #160 rehearsal, byte for byte.
 * The synthetic out-roots go to --data-root (large; regenerable from the seed) and are not committed. Exit code 1 when
 * any check fails. Uses no model, no sealed task and no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_OPTIONS, METRIC_LABEL, OUTCOME_IDS, analyse, parsePlan, pilotSwitch } from './lib/study2-analysis.js';
import type { AnalysisOptions, OutcomeId } from './lib/study2-analysis.js';
import { loadOutRoot, writeOutRoot } from './lib/study2-io.js';
import { DEFAULT_ASSUMPTIONS, DESIGN_OPTIONS, power } from './lib/study2-power.js';
import { calibrate, calibratePlan, scenarioChecks, seedStability } from './lib/study2-rehearsal.js';
import type { Check, PlanCalibrationRow, StabilityRow } from './lib/study2-rehearsal.js';
import { forestSvg, renderReport, trajectorySvg } from './lib/study2-report.js';
import { PILOT_DESIGN, PLANNED_DESIGN, SCENARIOS, generateStudy } from './lib/study2-synth.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};
const int = (name: string, def: number): number => {
  const v = Number(opt(name, String(def)));
  if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${name} must be a non-negative integer`);
  return v;
};
const r2 = (x: number): string => x.toFixed(2);

try {
  const dataRoot = opt('--data-root', '');
  const out = opt('--out', '');
  if (dataRoot === '' || out === '') throw new Error('--data-root and --out are required');
  const seed = int('--seed', 20261016);
  const calSims = int('--calibration-sims', 200);
  const powerSims = int('--power-sims', 400);
  const planFile = opt('--plan', '');
  const plan = planFile === '' ? undefined : parsePlan(JSON.parse(fs.readFileSync(planFile, 'utf8')));
  const outcomeArg = opt('--outcome', '');
  const outcomes = outcomeArg === '' ? [] : outcomeArg.split(',').map((x) => x.trim());
  for (const x of outcomes) if (!(OUTCOME_IDS as readonly string[]).includes(x)) throw new Error(`--outcome: unknown ${x}`);
  if (plan === undefined && (outcomes.length > 0 || argv.includes('--stability-seeds'))) throw new Error('--outcome and --stability-seeds need --plan');
  const stabilitySeeds = int('--stability-seeds', 10);
  // Plan mode: the analysis seed, flips, resamples and α come from the plan; --seed still seeds the synthetic data.
  const aOpts: AnalysisOptions =
    plan === undefined
      ? { ...DEFAULT_OPTIONS, seed }
      : { ...DEFAULT_OPTIONS, alpha: plan.alpha, seed: plan.seed, flips: plan.flips, resamples: plan.resamples, plan, seedSource: 'plan', ...(outcomes.length > 0 ? { outcomes: outcomes as OutcomeId[] } : {}) };
  const stability: { scenario: string; rows: StabilityRow[] }[] = [];
  fs.mkdirSync(out, { recursive: true });
  const runs: { id: string; label: string; advisoryByRule: boolean; checks: Check[] }[] = [];
  const variants = [...SCENARIOS.map((s) => ({ s, byRule: true })), { s: SCENARIOS.find((x) => x.floor) ?? SCENARIOS[3], byRule: false }];
  for (const { s, byRule } of variants) {
    if (s === undefined) continue;
    const id = byRule ? s.id : `${s.id}-pre-142`;
    const dir = path.join(dataRoot, id);
    fs.rmSync(dir, { recursive: true, force: true });
    const study = generateStudy(PLANNED_DESIGN, s, { seed, advisoryByRule: byRule });
    const pilot = generateStudy(PILOT_DESIGN, s, { seed: seed + 1, advisoryByRule: byRule, taskPrefix: 'synth-pilot-task-' });
    writeOutRoot(path.join(dir, 'study2'), study);
    writeOutRoot(path.join(dir, 'pilot'), pilot);
    fs.writeFileSync(path.join(dir, 'truth.json'), `${JSON.stringify({ study2: study.truth, pilot: pilot.truth }, null, 1)}\n`);
    // Read back from disk through the harness reader: the analysis never sees the in-memory records or the truth.
    const loaded = loadOutRoot(path.join(dir, 'study2'));
    const decision = pilotSwitch(loadOutRoot(path.join(dir, 'pilot')).runs, null);
    const report = analyse(loaded.runs, loaded.scheduled, decision, aOpts);
    if (plan !== undefined && !byRule && (s.id === 'null' || s.id === 'expected')) {
      stability.push({ scenario: s.id, rows: seedStability(loaded.runs, loaded.scheduled, decision, aOpts, Array.from({ length: stabilitySeeds }, (_, i) => plan.seed + i)) });
    }
    const checks = scenarioChecks(s, report, study.truth, byRule);
    const tdir = path.join(out, id);
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'report.md'), renderReport(report, `Study 2 analysis rehearsal: scenario ${id} (${s.label})${byRule ? '' : ' — records as written before PR #142 (no advisoryByRule)'}`));
    fs.writeFileSync(path.join(tdir, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
    fs.writeFileSync(path.join(tdir, 'F1-trajectory.svg'), trajectorySvg(report.trajectories.primary, METRIC_LABEL[report.primaryMetric].replace(/, slope per step$|^Erosion slope: /g, ''), `F1. ${id}: primary outcome per step, by arm`));
    for (const c of report.confirmatory) fs.writeFileSync(path.join(tdir, `F2-forest-${c.arm}-vs-${c.reference}.svg`), forestSvg(c, `F2. ${id}: task-level effects, ${c.arm} − ${c.reference}`));
    fs.writeFileSync(path.join(tdir, 'checks.json'), `${JSON.stringify(checks, null, 1)}\n`);
    runs.push({ id, label: s.label, advisoryByRule: byRule, checks });
    process.stdout.write(`${id}: ${String(checks.filter((c) => c.pass).length)}/${String(checks.length)} checks pass\n`);
  }

  // Power at the planned N (design B) from the power simulation, per scenario.
  const B = DESIGN_OPTIONS.find((d) => d.name.startsWith('B'));
  if (B === undefined) throw new Error('design B missing');
  const powerRows = SCENARIOS.map((s, i) => {
    const cell = power(B, { ...DEFAULT_ASSUMPTIONS, effects: s.effects }, s.floor ? 'advisory-per-kloc' : 'blocking', 'block', { sims: powerSims, flips: 999, seed: seed + 50 + i });
    return { scenario: s.id, outcome: cell.outcome, powerGate: cell.powerGate, powerMcp: cell.powerMcp, powerAny: cell.powerAny, mcSe: cell.mcSe };
  });

  // Calibration of the full pipeline (generator → analysis), in memory, cheaper resampling.
  const calOpts = { ...DEFAULT_OPTIONS, resamples: 999, flips: 1999 };
  const cal = calSims === 0 || plan !== undefined ? [] : SCENARIOS.map((s, i) => calibrate(s, calSims, seed + 7 + i, calOpts));
  const calPlan: PlanCalibrationRow[] = calSims === 0 || plan === undefined ? [] : SCENARIOS.flatMap((s, i) => calibratePlan(s, calSims, seed + 7 + i, { ...aOpts, outcomes: [], resamples: 999, flips: 1999 }));

  // Monte Carlo seed sensitivity of the confirmatory decision (rehearsal doc A12): the `expected` data set, fixed,
  // analysed under analysis seeds 1..8 at the default flips.
  const exp = SCENARIOS.find((x) => x.id === 'expected');
  if (exp === undefined) throw new Error('expected scenario missing');
  const expStudy = generateStudy(PLANNED_DESIGN, exp, { seed });
  const expPilot = generateStudy(PILOT_DESIGN, exp, { seed: seed + 1, taskPrefix: 'synth-pilot-task-' });
  const seedRows = [1, 2, 3, 4, 5, 6, 7, 8].map((analysisSeed) => {
    const rep = analyse(expStudy.runs, expStudy.schedule.runs, pilotSwitch(expPilot.runs, null), { ...DEFAULT_OPTIONS, seed: analysisSeed, primaryOnly: true });
    return { analysisSeed, contrasts: rep.confirmatory.map((c) => ({ arm: c.arm, p: c.p, holmP: c.holmP ?? null, reject: c.holmReject === true })) };
  });

  const md: string[] = ['# Study 2 analysis rehearsal: summary (SYNTHETIC; not a pre-registration)', '', `Seed ${String(seed)}. Planned design: ${String(PLANNED_DESIGN.tasks)} tasks × ${String(PLANNED_DESIGN.models.length)} models × ${String(PLANNED_DESIGN.replicates)} replicates × ${String(PLANNED_DESIGN.arms.length)} arms, k = ${String(PLANNED_DESIGN.steps)} (outline §6; power notes option B). Pilot: ${String(PILOT_DESIGN.tasks)} tasks × ${PILOT_DESIGN.arms.join('/')} , k = ${String(PILOT_DESIGN.steps)}.`, ''];
  md.push('## Checks per scenario', '', '| Scenario | Check | Result | Detail |', '|---|---|---|---|');
  for (const r of runs) for (const c of r.checks) md.push(`| ${r.id} | ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`);
  md.push('', `## Power at the planned N (power simulation, design B, ${String(powerSims)} simulated studies, block-level sign-flip, Holm)`, '', '| Scenario | Outcome | Power gate | Power mcp | Power either | MC SE ≤ |', '|---|---|---|---|---|---|');
  for (const p of powerRows) md.push(`| ${p.scenario} | ${p.outcome} | ${r2(p.powerGate)} | ${r2(p.powerMcp)} | ${r2(p.powerAny)} | ${r2(p.mcSe)} |`);
  if (cal.length > 0) {
    md.push('', `## Calibration of the full pipeline (${String(calSims)} synthetic studies per scenario; generator → analysis; 999 resamples, 1999 flips)`, '', '| Scenario | Holm reject gate | Holm reject mcp | CI covers truth (gate) | CI covers truth (mcp) | Rel. reduction CI covers planted (gate) | Mean estimate gate | Mean truth gate | Sign-flip and bootstrap CI disagree (gate) |', '|---|---|---|---|---|---|---|---|---|');
    for (const c of cal) md.push(`| ${c.scenario} | ${r2(c.rejectGate)} | ${r2(c.rejectMcp)} | ${r2(c.coverGate)} | ${r2(c.coverMcp)} | ${r2(c.coverRelGate)} | ${c.meanEstGate.toFixed(3)} | ${c.meanTruthGate.toFixed(3)} | ${r2(c.signFlipVsBootstrapDisagree)} |`);
  }
  md.push('', `## Monte Carlo seed sensitivity (scenario expected, data seed ${String(seed)}, analysis seeds 1–8, ${String(DEFAULT_OPTIONS.flips)} flips)`, '', '| Analysis seed | gate Holm p | gate rejected | mcp Holm p | mcp rejected |', '|---|---|---|---|---|');
  for (const r of seedRows) {
    const g = r.contrasts.find((c) => c.arm === 'gate');
    const m = r.contrasts.find((c) => c.arm === 'daedalus-mcp');
    md.push(`| ${String(r.analysisSeed)} | ${g?.holmP?.toFixed(4) ?? 'n/a'} | ${g?.reject === true ? 'yes' : 'no'} | ${m?.holmP?.toFixed(4) ?? 'n/a'} | ${m?.reject === true ? 'yes' : 'no'} |`);
  }
  if (calPlan.length > 0) {
    md.push('', `## Calibration per scale and inference method (plan mode; ${String(calSims)} synthetic studies per scenario; 999 resamples, 1999 flips; exact sign-flip at ≤ ${String(plan?.exactMaxUnits ?? 0)} units)`, '', 'Rates over the simulated studies. Under `null` every rate is the test size. Coverage of the generating value is shown for the raw (and advisory) scale only: the generator\'s truth file has no per-KLOC slope.', '', '| Scenario | Scale | Contrast | Sign-flip, Holm | Sign-flip, unadjusted | Bootstrap CI excludes 0 | Disagree (CI vs p) | CI covers truth |', '|---|---|---|---|---|---|---|---|');
    for (const c of calPlan) for (const a of c.arms) md.push(`| ${c.scenario} | ${c.scale} | ${a.arm} − none | ${r2(a.signFlipHolm)} | ${r2(a.signFlipUnadjusted)} | ${r2(a.bootstrap)} | ${r2(a.disagree)} | ${Number.isNaN(a.cover) ? 'n/a' : r2(a.cover)} |`);
  }
  for (const st of stability) {
    md.push('', `## Decision stability across ${String(stabilitySeeds)} seeds (scenario ${st.scenario}; seeds ${String(plan?.seed ?? 0)}..${String((plan?.seed ?? 0) + stabilitySeeds - 1)}; same data)`, '', 'Exact enumeration must give identical p on every seed. Monte Carlo p varies with the seed; the plan file fixes which seed is used.', '', '| Scope | Contrast | Units | Test | p min | p max | Identical on every seed | Seeds rejecting |', '|---|---|---|---|---|---|---|---|');
    for (const r of st.rows) md.push(`| ${r.scope} | ${r.contrast} | ${String(r.units)} | ${r.method} | ${r.pMin === null ? 'n/a' : r.pMin.toFixed(4)} | ${r.pMax === null ? 'n/a' : r.pMax.toFixed(4)} | ${r.identical ? 'yes' : 'NO'} | ${String(r.rejects)} of ${String(r.seeds)} |`);
  }
  md.push('');
  fs.writeFileSync(path.join(out, 'summary.md'), md.join('\n'));
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify({ note: 'SYNTHETIC rehearsal; not a pre-registration.', seed, checks: runs, power: powerRows, calibration: cal, seedSensitivity: seedRows, ...(plan !== undefined ? { plan, calibrationPlan: calPlan, stability } : {}) }, null, 1)}\n`);
  process.stdout.write(md.join('\n'));
  if (runs.some((r) => r.checks.some((c) => !c.pass))) process.exitCode = 1;
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
}
