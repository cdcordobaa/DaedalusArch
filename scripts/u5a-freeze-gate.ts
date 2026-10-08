/**
 * Dev-split declaration gate (FR-24 amendment; BR-U5a-36 a). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): GOLDEN_REQUIRED=1 NEO4J_URI=… npx tsx scripts/u5a-freeze-gate.ts --manifest <path>
 *   --copies <out root> --base <fixture dir> --out <dir>
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/freeze-gate-main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
