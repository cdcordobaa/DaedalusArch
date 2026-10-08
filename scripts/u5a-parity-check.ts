/**
 * Import-graph parity check on prepared bases (BR-U5a-56; D-U5a-15). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/u5a-parity-check.ts --bases <list.json of PreparedBase> [--spec <path>]
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/parity-check-main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
