/**
 * `loop-telemetry-check` (readiness gate D6): completeness of a loop out-root's telemetry, including the MCP call log.
 * Entry file: no exports. Checks and definitions: `scripts/lib/loop/telemetry-check.ts`. Reads only; no model call,
 * no Neo4j, no network.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/loop-telemetry-check.ts <outRoot> [--allow-incomplete] [--json <report.json>]
 *
 * Prints one line per problem and a summary. Exit codes: 0 no problem, 1 at least one problem, 2 usage or I/O error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkTelemetry } from '../lib/loop/telemetry-check.js';

const argv = process.argv.slice(2);
const jsonAt = argv.indexOf('--json');
const jsonFile = jsonAt >= 0 ? argv[jsonAt + 1] : undefined;
const positional = argv.filter((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1));
try {
  const outRoot = positional[0];
  if (outRoot === undefined || positional.length !== 1 || (jsonAt >= 0 && jsonFile === undefined)) {
    process.stderr.write('usage: loop-telemetry-check.ts <outRoot> [--allow-incomplete] [--json <report.json>]\n');
    process.exit(2);
  }
  const report = checkTelemetry(path.resolve(outRoot), { allowIncomplete: argv.includes('--allow-incomplete') });
  for (const p of report.problems) {
    process.stdout.write(`MISSING ${p.runId}${p.step !== null ? ` ${p.step}` : ''}${p.turnId !== null ? ` ${p.turnId}` : ''}: ${p.problem}\n`);
  }
  process.stdout.write(
    `telemetry: ${String(report.runs)} runs, ${String(report.steps)} steps, ${String(report.turns)} turns, ${String(report.mcpCalls)} MCP calls, ${String(report.problems.length)} problem(s)\n`,
  );
  if (jsonFile !== undefined) fs.writeFileSync(jsonFile, `${JSON.stringify(report, null, 1)}\n`);
  process.exitCode = report.ok ? 0 : 1;
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
