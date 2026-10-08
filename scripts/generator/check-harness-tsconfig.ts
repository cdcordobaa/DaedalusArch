/**
 * D-U5a-9 harness tsconfig check (BR-U5a-42, 45): temp harness, real skeleton install, the two-file project type-checks
 * with 0 errors under the per-run tsconfig, then exactly 1 error with a bad assignment. Entry file (D-U5a-13 a).
 * Usage (repository root): npx tsx scripts/generator/check-harness-tsconfig.ts
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { checkHarnessTsconfigMain } from '../lib/generators/skeleton.js';

void checkHarnessTsconfigMain(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
