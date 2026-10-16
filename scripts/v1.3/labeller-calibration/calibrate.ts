/**
 * v1.3 labeller calibration: entry file (no exports). Commands and the exact local run sequence are in
 * Docs/v1.3/labeller-calibration-plan.md §8.
 *
 *   npx tsx scripts/v1.3/labeller-calibration/calibrate.ts fetch|sample|dry-run|record|score ...
 */
import { calibrationMain } from './lib/main.js';

calibrationMain(process.argv.slice(2), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  repoRoot: process.cwd(),
}).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
