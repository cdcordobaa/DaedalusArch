/**
 * FR-V5 validation runner over the v1.3 reference projects. Entry file: no exports.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/validate-reference.ts --check
 *   npx tsx scripts/v1.3/validate-reference.ts --materialise /tmp/v13-variants
 *   NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... npx tsx scripts/v1.3/validate-reference.ts [--style nestjs] [--out results/v1.3-reference]
 *   npx tsx scripts/v1.3/validate-reference.ts --from-raw results/v1.3-reference/raw
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { main } from './lib/validate-reference-main.js';

void main(process.argv.slice(2), process.cwd(), {
  env: process.env,
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
}).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
