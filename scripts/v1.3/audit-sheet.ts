/**
 * v1.3 labelling: author-audit sheet (blind to the rule id) and agreement calculator (kappa, AC1, Wilson).
 * Entry file: no exports.
 * Usage: npx tsx scripts/v1.3/audit-sheet.ts sheet --sample <sample.json> --jobs <jobs.json> --seed <n> --out <dir> [--n 30]
 *        npx tsx scripts/v1.3/audit-sheet.ts agreement --key <audit-key.json> --answers <audit-answers.csv> --labels <labels.json>
 *          [--correctness <correctness.json>] --out <agreement.json>
 *        npx tsx scripts/v1.3/audit-sheet.ts union --run <run dir> --materialise <dir> --seed <n> --n 60|120
 *          --sheet-out <sheet.md> --key-out <key.json> [--root <reference dir>] [--id-map <file>] [--sample-out <json> --jobs-out <json>]
 *        npx tsx scripts/v1.3/audit-sheet.ts union-agreement --key <key.json> --raters second=<a.md>,author=<b.md>
 *          [--model gemini=<labels.json>] --out <agreement.json> [--md-out <agreement.md>]
 *        (union modes: scripts/v1.3/lib/labelling/union-main.ts; protocol Docs/v1.3/human-labelling-protocol.md)
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { auditMain } from './lib/labelling/mains.js';

const io = { env: process.env, out: (t: string) => process.stdout.write(t), err: (t: string) => process.stderr.write(t) };

Promise.resolve().then(() => auditMain(process.argv.slice(2), io)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.GEMINI_API_KEY ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
