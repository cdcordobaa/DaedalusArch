/**
 * Live confinement probes of the Codex arm (SECURITY-11; ADR-029), run before any Codex generation.
 * Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/generator/probes/codex-confinement-cli.ts --plan <plan> --binary <abs> --harness-root <abs> [--only <ids>]
 */
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { codexConfinementMain } from './codex-confinement.js';

void codexConfinementMain(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
