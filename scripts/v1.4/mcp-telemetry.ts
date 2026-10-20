/**
 * MCP tool-call telemetry of a `daedalus-mcp` loop out-root (Study 2b scoring, `Docs/v1.4/study2b-runbook.md` §6;
 * the 2a report §11 table). Entry file: no exports. Helpers: `scripts/v1.4/lib/mcp-telemetry.ts`. Reads only; zero
 * model calls, no Neo4j, no network.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/mcp-telemetry.ts --out-root <mcp out-root> --out <dir>
 *
 * For every run under `<out-root>/runs`, every step record with a generator turn (inherited step-1 copies skipped):
 * the `process` block and the call log lines it names. Writes `<out>/telemetry.json` ({ perStep, summary }); file
 * paths in the logs are repository-relative already, and no out-root path is written. Exit 0 ok, 1 a step has no
 * process block or a log it names is missing, 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { summariseTelemetry, telemetryStep } from './lib/mcp-telemetry.js';
import type { McpCallLine, ProcessBlock, TelemetryStep } from './lib/mcp-telemetry.js';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

function runDirs(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps', 'calls', 'node_modules', 'home'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

function main(): number {
  const root = arg('out-root');
  const outDir = arg('out');
  if (root === undefined || outDir === undefined) {
    process.stderr.write('usage: mcp-telemetry.ts --out-root <dir> --out <dir>\n');
    return 2;
  }
  const perStep: TelemetryStep[] = [];
  let problems = 0;
  for (const runDir of runDirs(path.join(path.resolve(root), 'runs'))) {
    const run = readJson<{ runId: string; spec: { taskId: string; arm: string; runIndex: number } }>(path.join(runDir, 'run.json'));
    if (run.spec.arm !== 'daedalus-mcp') continue;
    const files = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort();
    for (const f of files) {
      const rec = readJson<{ stepIndex: number; inherited?: unknown; process?: ProcessBlock & { logs?: readonly string[] } }>(path.join(runDir, 'steps', f));
      if (rec.inherited !== undefined) continue;
      const where = { task: run.spec.taskId, rep: run.spec.runIndex + 1, step: rec.stepIndex + 1 };
      if (rec.process === undefined) {
        process.stdout.write(`PROBLEM ${run.runId} step ${String(where.step)}: no process block\n`);
        problems++;
        continue;
      }
      const lines: McpCallLine[] = [];
      for (const log of rec.process.logs ?? []) {
        const p = path.join(runDir, log);
        if (!fs.existsSync(p)) {
          process.stdout.write(`PROBLEM ${run.runId} step ${String(where.step)}: call log ${log} missing\n`);
          problems++;
          continue;
        }
        for (const l of fs.readFileSync(p, 'utf8').split('\n')) if (l.trim() !== '') lines.push(JSON.parse(l) as McpCallLine);
      }
      perStep.push(telemetryStep(where, rec.process, lines));
    }
  }
  const summary = summariseTelemetry(perStep);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'telemetry.json'), `${JSON.stringify({ perStep, summary }, null, 1)}\n`);
  process.stdout.write(`mcp telemetry: ${String(summary.turns)} turns, ${String(summary.calls)} calls, ${String(summary.errors)} errors, first call before first write in ${String(summary.turnsWithFirstCallBeforeFirstWrite)}/${String(summary.turns)}, log mismatches ${String(summary.logMismatches)}\n`);
  for (const [tool, t] of Object.entries(summary.byTool)) process.stdout.write(`  ${tool}: ${String(t.calls)} calls in ${String(t.turns)} turns\n`);
  for (const [tool, v] of Object.entries(summary.checkVerdicts)) process.stdout.write(`  ${tool} verdicts: ${JSON.stringify(v)}\n`);
  return problems > 0 ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
