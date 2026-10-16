/**
 * Base-rate sweep for Docs/v1.3/study2-task-design.md §5. INFORMAL DESIGN AID, NOT A PRE-REGISTRATION.
 * Re-runs the PR #119 power model (scripts/v1.3/lib/study2-power.ts) unchanged, varying only the `none` arm's
 * erosion rate (slopePerStep), the step-1 level (baseCount) and the dispersion θ, to find the erosion rate the
 * tasks must produce for the block-level test to reach power 0.80. Synthetic counts only; no sealed task is used.
 * Usage (repository root):
 *   npx tsx Docs/v1.3/study2-task-design/base-rate-sweep.ts [--sims 400] [--seed 20261016] [--out <json>]
 */
import * as fs from 'node:fs';
import { DEFAULT_ASSUMPTIONS, DESIGN_OPTIONS, power } from '../../../scripts/v1.3/lib/study2-power.js';
import type { PowerAssumptions } from '../../../scripts/v1.3/lib/study2-power.js';

const argv = process.argv.slice(2);
const opt = (n: string, d: string): string => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] ?? d : d);
const sims = Number(opt('--sims', '400'));
const seed = Number(opt('--seed', '20261016'));

const designs = DESIGN_OPTIONS.filter((d) => /^[BCE]:/.test(d.name));
const slopes = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const bases = [0.5, 1.5, 4];
const dispersions: (number | null)[] = [0.8, 2, 5, null];

const rows: Record<string, unknown>[] = [];
for (const d of designs) {
  for (const disp of dispersions) {
    for (const base of bases) {
      for (const slope of slopes) {
        // Only the full slope grid at the default base; the other bases at three slopes.
        if (base !== DEFAULT_ASSUMPTIONS.baseCount && ![0.5, 1, 2].includes(slope)) continue;
        const a: PowerAssumptions = { ...DEFAULT_ASSUMPTIONS, baseCount: base, slopePerStep: slope, dispersion: disp };
        const c = power(d, a, 'blocking', 'block', { sims, flips: 999, seed });
        rows.push({ design: d.name.slice(0, 1), k: d.steps, theta: disp ?? 'Poisson', base, slope, gate: c.powerGate, mcp: c.powerMcp });
        process.stdout.write(`${d.name.slice(0, 1)}\tθ=${disp ?? 'P'}\tbase=${base}\tslope=${slope}\tgate=${c.powerGate.toFixed(2)}\tmcp=${c.powerMcp.toFixed(2)}\n`);
      }
    }
  }
}
const out = opt('--out', '');
if (out !== '') fs.writeFileSync(out, JSON.stringify({ note: 'informal design aid; synthetic', sims, seed, effects: DEFAULT_ASSUMPTIONS.effects, rows }, null, 1) + '\n');
