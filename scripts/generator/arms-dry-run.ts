/**
 * v1.3 firewall-in-the-loop (DRAFT): print the argv and MCP config of each tool arm. Never calls the CLI or a model.
 * Usage (repository root): npx tsx scripts/generator/arms-dry-run.ts [--plan <plan.json>] [--arm <arm>]... [--all] [--json]
 */
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { armsDryRunMain } from '../lib/generators/arms-dry-run.js';

try {
  process.exitCode = armsDryRunMain(
    process.argv.slice(2),
    { repoRoot: process.cwd(), nodeBinary: process.execPath },
    { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) },
  );
} catch (e: unknown) {
  process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
  process.exitCode = 2;
}
