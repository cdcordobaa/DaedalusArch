/**
 * v1.3 labelling: deterministic correctness checker (source code and spec, never the graph). Entry file: no exports.
 * Usage: npx tsx scripts/v1.3/check-correct.ts --jobs <jobs.json> [--sample <sample.json>] [--tiers blocking|all] --out <dir>
 *        npx tsx scripts/v1.3/check-correct.ts --coverage
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { checkMain } from './lib/labelling/mains.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };

Promise.resolve().then(() => checkMain(process.argv.slice(2), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.GEMINI_API_KEY ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
