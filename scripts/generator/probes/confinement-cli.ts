/**
 * Live confinement probes (SECURITY-11; BR-U5a-43), run in Build and Test before E1 or the acceptance cell.
 * Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/generator/probes/confinement-cli.ts --plan <plan.json> [--model <id>]
 */
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { confinementMain } from './confinement.js';

void confinementMain(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
