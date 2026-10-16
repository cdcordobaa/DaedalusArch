/**
 * Study 2 level-outcome power simulation (gate D3). A DESIGN AID, NOT A PRE-REGISTRATION. Entry file: no exports.
 * Model and test: scripts/v1.3/lib/level-power-sim.ts; reading: Docs/v1.3/level-power-sim-2026-10-16.md.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/level-power-sim.ts [--sims 2000] [--seed 20261016] [--out-dir results/v1.3-level-power-sim]
 * Writes power.json and tables.md to --out-dir and prints tables.md. No model call, no Neo4j, no sealed task, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  COLLAPSE_MEANS, SEED, STYLE_DATA, SWEEP, renderCollapseTable, renderSmallestTable, renderStyleTable, renderSweepTable,
  runCollapse, runSweep, styleParams,
} from './lib/level-power-sim.js';
import type { CellMeanInput, Correlation, Grid, Scenario, StyleData, StyleParams } from './lib/level-power-sim.js';

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
