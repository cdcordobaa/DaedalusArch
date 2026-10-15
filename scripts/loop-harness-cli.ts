/**
 * Firewall-in-the-loop multi-step generation grid (v1.3; Study 2 design support, NOT a pre-registration). Entry file.
 * Usage (repository root): npx tsx scripts/loop-harness-cli.ts --plan <plan.json> [--dry-run] | --help
 * (`scripts/lib/loop/main.ts`). `--dry-run` needs no model and no Neo4j.
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/loop/main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
