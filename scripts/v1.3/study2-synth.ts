/**
 * Study 2 analysis rehearsal: writes a SYNTHETIC loop out-root (and its pilot) for one scenario. NOT DATA, NOT A
 * PRE-REGISTRATION. Entry file: no exports. Generator: scripts/v1.3/lib/study2-synth.ts.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-synth.ts --scenario null|small|expected|floor --out <dir> [--seed 20261016] [--pre-142]
 * Writes <dir>/study2/ (the planned grid), <dir>/pilot/ (the memo's pilot) and <dir>/truth.json (generating
 * quantities, OUTSIDE both out-roots so the analysis never reads them). Uses no model, no sealed task, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeOutRoot } from './lib/study2-io.js';
import { PILOT_DESIGN, PLANNED_DESIGN, SCENARIOS, generateStudy } from './lib/study2-synth.js';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};

try {
  const scenario = SCENARIOS.find((s) => s.id === opt('--scenario', ''));
  if (scenario === undefined) throw new Error(`--scenario must be one of ${SCENARIOS.map((s) => s.id).join(', ')}`);
  const out = opt('--out', '');
  if (out === '') throw new Error('--out <dir> is required');
  const seed = Number(opt('--seed', '20261016'));
  if (!Number.isSafeInteger(seed)) throw new Error('--seed must be an integer');
  const advisoryByRule = !argv.includes('--pre-142');
  const study = generateStudy(PLANNED_DESIGN, scenario, { seed, advisoryByRule });
  const pilot = generateStudy(PILOT_DESIGN, scenario, { seed: seed + 1, advisoryByRule, taskPrefix: 'synth-pilot-task-' });
  writeOutRoot(path.join(out, 'study2'), study);
  writeOutRoot(path.join(out, 'pilot'), pilot);
  fs.writeFileSync(path.join(out, 'truth.json'), `${JSON.stringify({ study2: study.truth, pilot: pilot.truth }, null, 1)}\n`);
  process.stdout.write(`${scenario.id}: ${String(study.runs.length)} study runs, ${String(pilot.runs.length)} pilot runs → ${out}\n`);
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
