/**
 * The one-time v1.3 hold-out run and its scoring (Docs/v1.3/holdout-prespec.md). Entry file: no exports.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/holdout-run.ts --dry-run --holdout <unsealed dir> [--id-map <file>] [--expect-sha256 <hex>]
 *   NEO4J_URI=... NEO4J_PASSWORD=... npx tsx scripts/v1.3/holdout-run.ts --commit <FREEZE_SHA> --holdout <unsealed dir>
 *     --out results/v1.3-holdout/run-1 [--id-map <file>] [--deferred FF-DS01] [--graph-adjudication <file>]
 *   npx tsx scripts/v1.3/holdout-run.ts --commit <FREEZE_SHA> --holdout <dir> --from-raw results/v1.3-holdout/run-1 --out <dir>
 * Development-set stand-in (tests the runner; never a validity figure):
 *   npx tsx scripts/v1.3/holdout-run.ts --development-stand-in --commit HEAD --holdout tests/fixtures/v1.3-reference --out <dir>
 * Options and exit codes: scripts/v1.3/lib/holdout-run-main.ts.
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { holdoutMain } from './lib/holdout-run-main.js';

const secrets = [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
void holdoutMain(process.argv.slice(2), process.cwd(), {
  env: process.env,
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(scrubSecrets(t, secrets)),
}).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
