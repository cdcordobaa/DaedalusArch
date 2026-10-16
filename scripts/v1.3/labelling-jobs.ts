/**
 * v1.3 labelling: build the jobs file (project root, spec, report per evaluated project). Entry file: no exports.
 * Usage (repository root; Docs/v1.3/labelling.md):
 *   npx tsx scripts/v1.3/labelling-jobs.ts --reference results/v1.3-reference/after-fixes/evidence --materialise <dir> --out <jobs.json>
 *   npx tsx scripts/v1.3/labelling-jobs.ts --e1-runs results/e1-grid/runs --e1-plan experiments/e1-grid/plan.json [--spec <spec.yaml>] [--e1-root <dir>] --out <jobs.json>
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { jobsMain } from './lib/labelling/mains.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };

Promise.resolve().then(() => jobsMain(process.argv.slice(2), process.cwd(), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.GEMINI_API_KEY ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
