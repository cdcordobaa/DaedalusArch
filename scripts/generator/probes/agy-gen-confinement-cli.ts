/**
 * The S4 confinement probe of the Gemini generator (`Docs/v1.4/gemini-s4-probe-spec.md`; runbook
 * `Docs/v1.4/gemini-generator.md`). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root):
 *   npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --estimate
 *   npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --dry-run --plan experiments/loop-gemini/gemini-plan.template.json
 *   npx tsx scripts/generator/probes/agy-gen-confinement-cli.ts --plan <plan> --binary <abs> --harness-root <abs> --out-root <abs>
 *     --gemini-home-none <abs> --gemini-home-mcp <abs>          (live: at most 30 model calls)
 */
import * as fs from 'node:fs';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { systemClock } from '../../lib/generators/retry.js';
import { agyS4Main } from './agy-gen-confinement.js';
import { dryRunScratchArgs, scriptedS4 } from './agy-gen-confinement-dry-run.js';

const scratch = dryRunScratchArgs(process.argv.slice(2));
void agyS4Main(scratch?.argv ?? process.argv.slice(2), process.cwd(), {
  runner: new NodeProcessRunner(),
  clock: systemClock,
  parentEnv: process.env,
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  dryRun: scriptedS4,
})
  .then(
    (c) => {
      process.exitCode = c;
    },
    (e: unknown) => {
      process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
      process.exitCode = 2;
    },
  )
  .finally(() => {
    if (scratch !== null) fs.rmSync(scratch.scratch, { recursive: true, force: true });
  });
