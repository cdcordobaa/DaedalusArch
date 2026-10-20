/**
 * Claude S4 confinement probe of the daedalus-mcp arm (Docs/v1.4/claude-s4-mcp-probe-spec.md). Entry file: no exports.
 * Usage (repository root): npx tsx scripts/generator/probes/confinement-mcp-cli.ts --plan <plan> ... [--dry-run]
 */
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { createGeneratorCliConfig } from '../../lib/generators/config.js';
import { systemClock } from '../../lib/generators/retry.js';
import { ensureHarness } from '../../lib/generators/skeleton.js';
import { mcpSpecFor } from '../../lib/loop/plan.js';
import { s4McpMain } from './confinement-mcp.js';

const repoRoot = process.cwd();
const runner = new NodeProcessRunner();
const argv = process.argv.slice(2);
const harnessAt = argv.indexOf('--harness-root');
const harnessRoot = harnessAt >= 0 ? (argv[harnessAt + 1] ?? '') : '';

void s4McpMain(
  argv,
  repoRoot,
  { runner, clock: systemClock, parentEnv: process.env, out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) },
  {
    createConfig: (input) => createGeneratorCliConfig(input, repoRoot),
    ensureHarness: () => ensureHarness(runner, repoRoot, harnessRoot),
    // The plan JSON as read; mcpSpecFor reads only its daedalus block and task profiles.
    mcpSpecFor: (plan, taskId) => mcpSpecFor(plan as Parameters<typeof mcpSpecFor>[0], taskId, repoRoot),
  },
).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
