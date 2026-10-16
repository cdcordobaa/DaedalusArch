/**
 * v1.3 labelling: meaningful labeller (neutral prompt, 2 runs with permuted options, record/replay cassettes).
 * Entry file: no exports. Live calls happen only with --mode record and --provider codex|gemini.
 * Usage: npx tsx scripts/v1.3/label-meaningful.ts --sample <sample.json> --jobs <jobs.json> --estimate
 *        npx tsx scripts/v1.3/label-meaningful.ts --sample <sample.json> --jobs <jobs.json> --provider codex|gemini|mock --model <id>
 *          --mode record|replay --cassette-dir <dir> --seed <n> --out <labels.json>
 *          [--codex-home <abs> --codex-user-home <abs> [--codex-effort <e>]]   (codex; GEMINI_API_KEY for gemini)
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { labelMain } from './lib/labelling/mains.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };

Promise.resolve().then(() => labelMain(process.argv.slice(2), process.cwd(), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.GEMINI_API_KEY ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
