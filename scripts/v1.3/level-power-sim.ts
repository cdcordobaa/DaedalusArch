/**
 * Study 2 level-outcome power simulation (gate D3). A DESIGN AID, NOT A PRE-REGISTRATION. Entry file: no exports.
 * Model and test: scripts/v1.3/lib/level-power-sim.ts; reading: Docs/v1.3/level-power-sim-2026-10-16.md.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/level-power-sim.ts [--sims 2000] [--seed 20261016] [--out-dir results/v1.3-level-power-sim]
 * Writes power.json and tables.md to --out-dir and prints tables.md. No model call, no Neo4j, no sealed task, no network.
 *
 * Drift outcome (s2d-01 §3; reading: Docs/v1.4/drift-power-sim.md). `--outcome level` (default) is the run above,
 * unchanged.
 *   npx tsx scripts/v1.3/level-power-sim.ts --outcome drift [--sims 2000] [--seed 20261018] [--out-dir results/v1.3-drift-power-sim]
 *     the probe-1 placeholder table of s2d-01 §3 (24 and 32 blocks, both correlation models) and the collapse row;
 *   npx tsx scripts/v1.3/level-power-sim.ts --outcome drift --pilot <pilot.json> [--lower-bound 0.8] [--theta-band 1,4,inf] --out-dir <dir>
 *     drift record §4: each generator's input mean is the one-sided lower bound of its pilot mean D, over the θ band,
 *     at 4 tasks × 4 replicates × the pilot's generators, with the power-rule verdict. `<pilot.json>` is
 *     `{ "generators": { "<name>": [D, ...] } }`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  COLLAPSE_MEANS, DRIFT_DATA, DRIFT_RATE_RATIOS, DRIFT_SEED, OUTCOMES, POWER_RULE_RR, SEED, STYLE_DATA, SWEEP, driftParams,
  driftRow, parseThetaBand, pilotPower, renderCollapseTable, renderDriftTable, renderPilotReport, renderSmallestTable,
  renderStyleTable, renderSweepTable, runCollapse, runSweep, styleParams, validatePilot,
} from './lib/level-power-sim.js';
import type {
  CellMeanInput, Correlation, DriftGrid, DriftRow, Grid, Scenario, StyleData, StyleParams,
} from './lib/level-power-sim.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};
const int = (name: string, def: number): number => {
  const v = Number(opt(name, String(def)));
  if (!Number.isSafeInteger(v) || v <= 0) throw new Error(`${name} must be a positive integer`);
  return v;
};

const styleById = (id: string): StyleData => {
  const s = STYLE_DATA.find((x) => x.id === id);
  if (s === undefined) throw new Error(`unknown style ${id}`);
  return s;
};
const asInput = (p: StyleParams): CellMeanInput => ({ mean: p.fit.mean, theta: p.fit.theta });

/** Drift outcome (s2d-01 §3): the probe-1 reproduction table, or the pilot lower-bound mode (drift record §4). */
function runDrift(): void {
  const sims = int('--sims', 2000);
  const seed = int('--seed', DRIFT_SEED);
  const outDir = opt('--out-dir', 'results/v1.3-drift-power-sim');
  const pilotFile = opt('--pilot', '');
  const t0 = Date.now();
  let text: string;
  let json: unknown;
  if (pilotFile !== '') {
    const level = Number(opt('--lower-bound', '0.8'));
    const band = parseThetaBand(opt('--theta-band', '1,4,inf'));
    const pilot = validatePilot(JSON.parse(fs.readFileSync(pilotFile, 'utf8')) as unknown);
    const rep = pilotPower(pilot, level, band, sims, seed);
    text = [`# Drift power from the pilot (sims ${sims}, seed ${seed})`, '', `Pilot file: ${pilotFile}`, '', renderPilotReport(rep), ''].join('\n');
    json = { outcome: 'drift', mode: 'pilot', sims, seed, pilotFile, pilot, ...rep };
  } else {
    const params = [driftParams(DRIFT_DATA, 5, 'locf'), driftParams(DRIFT_DATA, 5, 'linear')];
    const base = params[0] as StyleParams;
    const input = asInput(base);
    const rows: DriftRow[] = [];
    const grids: DriftGrid[] = [{ tasks: 4, replicates: 3, generators: 2, k: 5 }, { tasks: 4, replicates: 4, generators: 2, k: 5 }];
    for (const grid of grids)
      for (const corr of ['independent', 'shared'] as const)
        for (const rr of DRIFT_RATE_RATIOS) rows.push(driftRow('probe 1, k = 5', [input], grid, rr, corr, sims, seed));
    const collapse: DriftRow[] = [];
    const grid32 = grids[1] as DriftGrid;
    for (const mean of [base.fit.mean, 1.5, 1.0, 0.75, 0.5]) {
      collapse.push(driftRow('collapse', [{ mean, theta: base.fit.theta }], grid32, POWER_RULE_RR, 'independent', sims, seed));
    }
    text = [
      `# Drift power, probe-1 placeholder inputs (sims ${sims}, seed ${seed})`,
      '',
      'Placeholders, not the power claim: the claim is re-based on the pilot (drift record §4).',
      '',
      '## Fitted D at k = 5',
      '',
      renderStyleTable(params),
      '',
      '## Power (s2d-01 §3 table)',
      '',
      renderDriftTable(rows),
      '',
      `## Collapse, 32 blocks, independent, RR ${String(POWER_RULE_RR)} (θ = ${base.fit.theta.toFixed(2)})`,
      '',
      renderDriftTable(collapse),
      '',
    ].join('\n');
    json = { outcome: 'drift', mode: 'probe-1', sims, seed, styles: params, rows, collapse };
  }
  const elapsedMs = Date.now() - t0;
  fs.mkdirSync(path.resolve(outDir), { recursive: true });
  // θ = ∞ (Poisson) is written as "inf"; JSON has no Infinity.
  const replacer = (_k: string, v: unknown): unknown => (v === Number.POSITIVE_INFINITY ? 'inf' : v);
  fs.writeFileSync(path.join(outDir, 'power.json'), JSON.stringify(json, replacer, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'tables.md'), text);
  process.stdout.write(text);
  process.stderr.write(`level-power-sim --outcome drift: done in ${(elapsedMs / 1000).toFixed(1)} s\n`);
}

const outcome = opt('--outcome', 'level');
if (!(OUTCOMES as readonly string[]).includes(outcome)) {
  process.stderr.write(`--outcome must be one of ${OUTCOMES.join(', ')}\n`);
  process.exitCode = 2;
} else if (outcome === 'drift') {
  try {
    runDrift();
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  }
} else {
  try {
    const sims = int('--sims', 2000);
    const seed = int('--seed', SEED);
    const outDir = opt('--out-dir', 'results/v1.3-level-power-sim');

    const params: StyleParams[] = [];
    for (const s of STYLE_DATA) for (const k of SWEEP.k) params.push(styleParams(s, k, 'locf'));
    params.push(styleParams(styleById('layered-measured'), 6, 'linear'));
    params.push(styleParams(styleById('layered-repaired'), 6, 'linear'));

    const at = (id: string, k: number, mode: 'locf' | 'linear' = 'locf'): CellMeanInput =>
      asInput(styleParams(styleById(id), k, mode));
    const layeredTheta = styleParams(styleById('layered-measured'), 4, 'locf').fit.theta;
    // DDD has never been scored on agent code (design §7): the go/no-go threshold mean 1.5, with the Layered θ.
    const dddThreshold: CellMeanInput = { mean: 1.5, theta: layeredTheta };
    const dddZero: CellMeanInput = { mean: 0, theta: layeredTheta };

    const scenarios: Scenario[] = [
      { id: 'layered-measured', label: 'All blocks Layered as measured', stylesAtK: (k) => [at('layered-measured', k)] },
      { id: 'layered-repaired', label: 'All blocks Layered after the composition-slot repair', stylesAtK: (k) => [at('layered-repaired', k)] },
      { id: 'layered-measured-linear', label: 'Layered as measured, k = 6 by linear growth', stylesAtK: (k) => [at('layered-measured', k, 'linear')] },
      { id: 'mixed-ddd-threshold', label: 'Half Layered as measured, half DDD at the go threshold (mean 1.5)', stylesAtK: (k) => [at('layered-measured', k), dddThreshold] },
      { id: 'mixed-ddd-zero', label: 'Half Layered as measured, half DDD at zero', stylesAtK: (k) => [at('layered-measured', k), dddZero] },
      { id: 'zero', label: 'Clean / Hexagonal zero stratum', stylesAtK: (k) => [at('zero', k)] },
    ];
    const corrs: Correlation[] = ['independent', 'shared'];
    const t0 = Date.now();
    const sweep = runSweep(scenarios, corrs, sims, seed);
    const collapseGrids: Grid[] = [{ tasks: 4, replicates: 3, k: 4 }, { tasks: 6, replicates: 4, k: 4 }];
    const collapse = runCollapse(COLLAPSE_MEANS, layeredTheta, collapseGrids, corrs, sims, seed);
    const elapsedMs = Date.now() - t0;

    const md: string[] = [`# Level-outcome power tables (sims ${sims}, seed ${seed})`, '', '## Fitted styles', '', renderStyleTable(params), ''];
    for (const sc of scenarios)
      for (const corr of corrs) {
        md.push(`## ${sc.label}, ${corr}`, '', '### Smallest grid reaching 0.80', '', renderSmallestTable(sweep, sc.id, corr), '');
        md.push('### Full sweep', '', renderSweepTable(sweep, sc.id, corr), '');
      }
    for (const g of collapseGrids)
      for (const corr of corrs)
        for (const rr of SWEEP.rateRatios) {
          md.push(`## Collapse, ${g.tasks} × ${g.replicates}, k = ${g.k}, ${corr}, RR ${rr} (θ = ${layeredTheta.toFixed(2)})`, '');
          md.push(renderCollapseTable(collapse, g, corr, rr), '');
        }
    const text = md.join('\n');

    fs.mkdirSync(path.resolve(outDir), { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'power.json'),
      JSON.stringify({ sims, seed, styles: params, scenarios: scenarios.map(({ id, label }) => ({ id, label })), sweep, collapse }, null, 1) + '\n',
    );
    fs.writeFileSync(path.join(outDir, 'tables.md'), text);
    process.stdout.write(text);
    process.stderr.write(`level-power-sim: ${sweep.length + collapse.length} cells in ${(elapsedMs / 1000).toFixed(1)} s\n`);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  }
}
