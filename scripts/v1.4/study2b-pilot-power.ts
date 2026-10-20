/**
 * Study 2b, §3 step 2 on the extended Claude-only grid (pre-registration `Docs/v1.4/study2b-preregistration.md` §3,
 * DELEG7, deviation DV7; Fable review 2026-10-20 finding 3). Entry file: no exports.
 *
 * The registered power rule is `pilotPower` of `scripts/v1.3/lib/level-power-sim.ts`, unchanged: the same pilot file,
 * lower-bound level, θ band, simulations and seed as the registered command. The only difference from the registered
 * entry (`scripts/v1.3/level-power-sim.ts --outcome drift --pilot`) is the grid: that entry fixes 4 tasks × 4
 * replicates × the pilot's generators, and this driver passes `pilotPower`'s own `grid` argument, 4 tasks × r
 * replicates × 1 generator, for each N = 4r of the grid. `scripts/v1.3` is not touched.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/study2b-pilot-power.ts --pilot results/v1.4-study2b-power/pilot-2a-stage-c.json
 *     [--grid 8,12,16,20,24,32,40] [--lower-bound 0.8] [--theta-band 1,4,inf] [--sims 2000] [--seed 20261018]
 *     [--out-dir results/v1.4-study2b-power/level-power-sim-grid]
 *
 * Writes <out-dir>/power.json (every row, both correlation models, every RR, θ and N) and <out-dir>/tables.md (per N
 * the registered report, then a summary at RR 0.25 for both models). Zero model calls, CPU only. Exit 0 ok, 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseThetaBand, pilotPower, POWER_RULE_RR, POWER_RULE_TARGET, renderPilotReport, validatePilot, type PilotPowerReport,
} from '../v1.3/lib/level-power-sim.js';
import { STUDY2B_GRID } from './lib/study2b-power.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};

function main(): number {
  const pilotFile = opt('--pilot', 'results/v1.4-study2b-power/pilot-2a-stage-c.json');
  const grid = opt('--grid', STUDY2B_GRID.join(',')).split(',').map(Number);
  if (grid.some((n) => !Number.isInteger(n) || n <= 0 || n % 4 !== 0)) {
    process.stderr.write('--grid: multiples of the 4 tasks\n');
    return 2;
  }
  const level = Number(opt('--lower-bound', '0.8'));
  const band = parseThetaBand(opt('--theta-band', '1,4,inf'));
  const sims = Number(opt('--sims', '2000'));
  const seed = Number(opt('--seed', '20261018'));
  const outDir = opt('--out-dir', 'results/v1.4-study2b-power/level-power-sim-grid');
  const pilot = validatePilot(JSON.parse(fs.readFileSync(pilotFile, 'utf8')) as unknown);
  const generators = Object.keys(pilot.generators).length;
  const reports: { N: number; replicates: number; report: PilotPowerReport }[] = grid.map((N) => ({
    N, replicates: N / 4, report: pilotPower(pilot, level, band, sims, seed, { tasks: 4, replicates: N / 4, generators, k: 5 }),
  }));
  const th = (t: number): string => (Number.isFinite(t) ? t.toFixed(0) : '∞');
  const f2 = (x: number): string => x.toFixed(2);
  const at = (rep: PilotPowerReport, corr: 'independent' | 'shared', h: 'H1' | 'H2'): string =>
    band.map((t) => {
      const row = rep.rows.find((r) => r.corr === corr && r.rr === POWER_RULE_RR && r.theta === t);
      return row === undefined ? '—' : f2(row.power[h]);
    }).join(' / ');
  const md: string[] = [
    `# Study 2b §3 step 2 on the extended grid (pilotPower, sims ${String(sims)}, seed ${String(seed)})`, '',
    `Pilot file: ${pilotFile}. Grid: 4 tasks × r replicates × ${String(generators)} generator, N = ${grid.join(', ')}. θ band ${band.map(th).join(', ')}; lower bound level ${String(level)}.`, '',
    `## Summary at RR ${String(POWER_RULE_RR)} (θ ${band.map(th).join(' / ')})`, '',
    '| N (blocks) | r | H1 independent | H2 independent | H1 shared | H2 shared | Keep (independent, every θ ≥ 0.80) |',
    '|---|---|---|---|---|---|---|',
    ...reports.map(({ N, replicates, report }) => `| ${String(N)} | ${String(replicates)} | ${at(report, 'independent', 'H1')} | ${at(report, 'independent', 'H2')} | ${at(report, 'shared', 'H1')} | ${at(report, 'shared', 'H2')} | ${report.verdict.H1.keep && report.verdict.H2.keep ? 'yes' : `no (H1 ${report.verdict.H1.keep ? 'keep' : 'demote'}, H2 ${report.verdict.H2.keep ? 'keep' : 'demote'})`} |`),
    '',
    `The binding model is "independent" (the drift record §4 rule: power ≥ ${String(POWER_RULE_TARGET)} at RR ${String(POWER_RULE_RR)} for every θ of the band). "shared" is reported beside it, as the drift record §4 requires.`, '',
    ...reports.flatMap(({ N, report }) => [`## N = ${String(N)}`, '', renderPilotReport(report), '']),
  ];
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'power.json'), `${JSON.stringify({ outcome: 'drift', mode: 'pilot-grid', sims, seed, pilotFile, pilot, level, band: band.map(th), grid, reports: reports.map((r) => ({ N: r.N, replicates: r.replicates, grid: r.report.grid, bounds: r.report.bounds, rows: r.report.rows.map((x) => ({ ...x, theta: th(x.theta) })), verdict: r.report.verdict })) }, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'tables.md'), md.join('\n'));
  process.stdout.write(md.slice(0, 8 + reports.length).join('\n') + '\n');
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
