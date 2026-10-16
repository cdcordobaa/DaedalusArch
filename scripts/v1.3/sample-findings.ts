/**
 * v1.3 labelling: per-rule sampler (all findings if fewer than 40, else a seeded 40 stratified by project).
 * Entry file: no exports. Usage: npx tsx scripts/v1.3/sample-findings.ts --jobs <jobs.json> --seed <n> --out <sample.json> [--tiers blocking|all]
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { sampleMain } from './lib/labelling/mains.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };

Promise.resolve().then(() => sampleMain(process.argv.slice(2), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.GEMINI_API_KEY ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
