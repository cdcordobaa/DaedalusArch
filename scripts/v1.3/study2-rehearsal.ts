/**
 * Study 2 analysis rehearsal, end to end: for each of the four scenarios, write a synthetic out-root in the harness
 * format, read it back from disk, run the analysis, check what it recovers, and write the tables and figures; then
 * the power at the planned N from the power simulation, and a calibration of the whole pipeline over many seeds.
 * NOT DATA, NOT A PRE-REGISTRATION. Entry file: no exports. Reading: Docs/v1.3/study2-analysis-rehearsal.md.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-rehearsal.ts --data-root <scratch dir> --out results/v1.3-study2-rehearsal
 *     [--seed 20261016] [--calibration-sims 200] [--power-sims 400]
 * The synthetic out-roots go to --data-root (large; regenerable from the seed) and are not committed. Exit code 1 when
 * any check fails. Uses no model, no sealed task and no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_OPTIONS, METRIC_LABEL, analyse, pilotSwitch } from './lib/study2-analysis.js';
import { loadOutRoot, writeOutRoot } from './lib/study2-io.js';
import { DEFAULT_ASSUMPTIONS, DESIGN_OPTIONS, power } from './lib/study2-power.js';
import { calibrate, scenarioChecks } from './lib/study2-rehearsal.js';
import type { Check } from './lib/study2-rehearsal.js';
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
  fs.mkdirSync(out, { recursive: true });
  const runs: { id: string; label: string; advisoryByRule: boolean; checks: Check[] }[] = [];
  const variants = [...SCENARIOS.map((s) => ({ s, byRule: false })), { s: SCENARIOS.find((x) => x.floor) ?? SCENARIOS[3], byRule: true }];
  for (const { s, byRule } of variants) {
    if (s === undefined) continue;
    const id = byRule ? `${s.id}-advisory-by-rule` : s.id;
    const dir = path.join(dataRoot, id);
    fs.rmSync(dir, { recursive: true, force: true });
    const study = generateStudy(PLANNED_DESIGN, s, { seed, advisoryByRule: byRule });
    const pilot = generateStudy(PILOT_DESIGN, s, { seed: seed + 1, advisoryByRule: byRule, taskPrefix: 'synth-pilot-task-' });
    writeOutRoot(path.join(dir, 'study2'), study);
    writeOutRoot(path.join(dir, 'pilot'), pilot);
    fs.writeFileSync(path.join(dir, 'truth.json'), `${JSON.stringify({ study2: study.truth, pilot: pilot.truth }, null, 1)}\n`);
    // Read back from disk through the harness reader: the analysis never sees the in-memory records or the truth.
    const loaded = loadOutRoot(path.join(dir, 'study2'));
    const report = analyse(loaded.runs, loaded.scheduled, pilotSwitch(loadOutRoot(path.join(dir, 'pilot')).runs, null), { ...DEFAULT_OPTIONS, seed });
    const checks = scenarioChecks(s, report, study.truth, byRule);
    const tdir = path.join(out, id);
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'report.md'), renderReport(report, `Study 2 analysis rehearsal: scenario ${id} (${s.label})${byRule ? ' — with advisoryByRule, NOT the v1.3 format' : ''}`));
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
  const cal = calSims === 0 ? [] : SCENARIOS.map((s, i) => calibrate(s, calSims, seed + 7 + i, calOpts));

  const md: string[] = ['# Study 2 analysis rehearsal: summary (SYNTHETIC; not a pre-registration)', '', `Seed ${String(seed)}. Planned design: ${String(PLANNED_DESIGN.tasks)} tasks × ${String(PLANNED_DESIGN.models.length)} models × ${String(PLANNED_DESIGN.replicates)} replicates × ${String(PLANNED_DESIGN.arms.length)} arms, k = ${String(PLANNED_DESIGN.steps)} (outline §6; power notes option B). Pilot: ${String(PILOT_DESIGN.tasks)} tasks × ${PILOT_DESIGN.arms.join('/')} , k = ${String(PILOT_DESIGN.steps)}.`, ''];
  md.push('## Checks per scenario', '', '| Scenario | Check | Result | Detail |', '|---|---|---|---|');
  for (const r of runs) for (const c of r.checks) md.push(`| ${r.id} | ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`);
  md.push('', `## Power at the planned N (power simulation, design B, ${String(powerSims)} simulated studies, block-level sign-flip, Holm)`, '', '| Scenario | Outcome | Power gate | Power mcp | Power either | MC SE ≤ |', '|---|---|---|---|---|---|');
  for (const p of powerRows) md.push(`| ${p.scenario} | ${p.outcome} | ${r2(p.powerGate)} | ${r2(p.powerMcp)} | ${r2(p.powerAny)} | ${r2(p.mcSe)} |`);
  if (cal.length > 0) {
    md.push('', `## Calibration of the full pipeline (${String(calSims)} synthetic studies per scenario; generator → analysis; 999 resamples, 1999 flips)`, '', '| Scenario | Holm reject gate | Holm reject mcp | CI covers truth (gate) | CI covers truth (mcp) | Rel. reduction CI covers planted (gate) | Mean estimate gate | Mean truth gate | Sign-flip and bootstrap CI disagree (gate) |', '|---|---|---|---|---|---|---|---|---|');
    for (const c of cal) md.push(`| ${c.scenario} | ${r2(c.rejectGate)} | ${r2(c.rejectMcp)} | ${r2(c.coverGate)} | ${r2(c.coverMcp)} | ${r2(c.coverRelGate)} | ${c.meanEstGate.toFixed(3)} | ${c.meanTruthGate.toFixed(3)} | ${r2(c.signFlipVsBootstrapDisagree)} |`);
  }
  md.push('');
  fs.writeFileSync(path.join(out, 'summary.md'), md.join('\n'));
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify({ note: 'SYNTHETIC rehearsal; not a pre-registration.', seed, checks: runs, power: powerRows, calibration: cal }, null, 1)}\n`);
  process.stdout.write(md.join('\n'));
  if (runs.some((r) => r.checks.some((c) => !c.pass))) process.exitCode = 1;
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
}
