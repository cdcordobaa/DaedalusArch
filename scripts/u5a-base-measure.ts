/**
 * Catalogue-freeze measurements on prepared bases (BR-U5a-36 b, c; BR-U5a-37). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/u5a-base-measure.ts typecheck|feasibility --bases <list.json> --out <dir>
 *   [--scratch <dir>] [--split held-out|dev]
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/base-measure-main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
