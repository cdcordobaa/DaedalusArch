/**
 * FR-24 mutation tool (BR-U5a-04, 09, 31, 55; D-U5a-14). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/mutate.ts --base <fixture|prepared.json> --spec <path> --operator <id>
 *   --manifest <path> --out <scratch> [--site <json>] [--k <n>] [--cycle-strategy simple-cycles|scc] | --help
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/mutation/mutate-main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
