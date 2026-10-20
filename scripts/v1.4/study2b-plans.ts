/**
 * Study 2b: fill the plan templates of `experiments/study2b/` for one tasks file (`Docs/v1.4/study2b-runbook.md` §3).
 * Entry file: no exports. Zero model calls, no Neo4j, no network. Helpers: `scripts/v1.4/lib/study2b-plans.ts`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/study2b-plans.ts --tasks <abs tasks.json> --out <abs dir> [--replicates <R>]
 *     [--expect-tasks-sha256 <hex>] [--acceptance-root <abs> | --no-acceptance] [--daedalus-build <abs>]
 *   npx tsx scripts/v1.4/study2b-plans.ts --count [--replicates <R>]
 *
 * The tasks file is read as data and never printed: the output names no task id, title or request (task ids in
 * messages become `<task-N>`). With `--expect-tasks-sha256` the file's sha256 must match before anything is written.
 * Writes `<out>/plan-none-L2.json`, `plan-none-L3.json`, `plan-mcp-L2.json` (mode 0600; they hold the task ids, so a
 * sealed run's plans are not opened either) and `<out>/plans.json` (hashes and budgets only).
 * `--count` prints the 2b call count for R replicates of 4 tasks × 5 steps and reads nothing.
 * Exit 0 ok; 1 a plan is refused by the harness's checks; 2 usage or I/O error; 3 the tasks sha256 differs.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { acceptanceCoverage, acceptanceStartBlocks, DEFAULT_REPLICATES, fillTemplate, parseTasks, study2bCalls, STUDY2B_TEMPLATES } from './lib/study2b-plans.js';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const out = (s: string): void => {
  process.stdout.write(`${s}\n`);
};

function main(): number {
  const replicates = Number(arg('replicates') ?? String(DEFAULT_REPLICATES));
  if (!Number.isInteger(replicates) || replicates < 1) {
    process.stderr.write('--replicates must be a positive integer\n');
    return 2;
  }
  if (argv.includes('--count')) {
    const c = study2bCalls(replicates);
    out(`R = ${String(replicates)}, 4 tasks x 5 steps: step 1 ${String(c.step1)}; none@L2 steps 2-5 ${String(c.noneL2Steps2toK)}; none@L3 ${String(c.perBranchCell)}; mcp@L2 ${String(c.perBranchCell)}; total ${String(c.total)} step turns, 0 repairs`);
    return 0;
  }
  const tasksArg = arg('tasks');
  const outArg = arg('out');
  const acc = arg('acceptance-root');
  const noAcc = argv.includes('--no-acceptance');
  const build = arg('daedalus-build');
  if (tasksArg === undefined || outArg === undefined || !path.isAbsolute(tasksArg) || !path.isAbsolute(outArg) || (acc === undefined) === !noAcc) {
    process.stderr.write('usage: study2b-plans.ts --tasks <abs> --out <abs> [--replicates R] [--expect-tasks-sha256 <hex>] (--acceptance-root <abs> | --no-acceptance) [--daedalus-build <abs>]\n');
    return 2;
  }
  if ((acc !== undefined && !path.isAbsolute(acc)) || (build !== undefined && !path.isAbsolute(build))) {
    process.stderr.write('--acceptance-root and --daedalus-build must be absolute\n');
    return 2;
  }
  const parsed = parseTasks(fs.readFileSync(tasksArg));
  out(`tasks sha256 ${parsed.sha256}`);
  const expect = arg('expect-tasks-sha256');
  if (expect !== undefined && expect !== parsed.sha256) {
    out(`TASKS SHA256 MISMATCH: expected ${expect}; nothing written`);
    return 3;
  }
  if (parsed.tasks === null) {
    for (const p of parsed.problems) out(`tasks: ${p}`);
    return 1;
  }
  const tasks = parsed.tasks;
  const steps = tasks.tasks.map((t) => t.steps.length);
  out(`tasks: ${String(tasks.tasks.length)}; steps per task: ${[...new Set(steps)].sort().join(', ')}; replicates R = ${String(replicates)}`);
  if (acc !== undefined) {
    const c = acceptanceCoverage(acc, tasks);
    out(`acceptance files present: ${String(c.present)} of ${String(c.expected)}; tasks with every step file: ${String(c.tasksComplete)} of ${String(c.tasks)}`);
    // The skeleton package.json has no start script and must stay byte-identical, so without a task startCommand the
    // runner can only record no-start-command (rehearsal 2026-10-20).
    const s = acceptanceStartBlocks(tasks);
    out(`tasks with acceptance.startCommand: ${String(s.startCommand)} of ${String(s.tasks)}; with buildCommand: ${String(s.buildCommand)}`);
  }
  const templates = path.resolve(process.cwd(), 'experiments/study2b');
  fs.mkdirSync(outArg, { recursive: true, mode: 0o700 });
  const summary: Record<string, unknown>[] = [];
  let refused = 0;
  let total = 0;
  for (const name of STUDY2B_TEMPLATES) {
    const tplFile = path.join(templates, `${name}.template.json`);
    const tplBytes = fs.readFileSync(tplFile);
    const filled = fillTemplate(JSON.parse(tplBytes.toString('utf8')), tasks, { tasksPath: tasksArg, replicates, acceptanceRoot: acc ?? null, daedalusBuild: build ?? null });
    for (const p of filled.problems) out(`${name}: ${p}`);
    if (filled.problems.length > 0) {
      refused++;
      continue;
    }
    const body = `${JSON.stringify(filled.plan, null, 1)}\n`;
    const file = path.join(outArg, `${name}.json`);
    fs.writeFileSync(file, body, { mode: 0o600 });
    const sha = createHash('sha256').update(body).digest('hex');
    total += filled.budget.maxCalls;
    summary.push({ plan: `${name}.json`, sha256: sha, template: `experiments/study2b/${name}.template.json`, templateSha256: createHash('sha256').update(tplBytes).digest('hex'), callBudget: filled.budget });
    out(`${name}.json: runs ${String(filled.budget.runs)}, step turns ${String(filled.budget.stepTurns)}, repairs ${String(filled.budget.maxRepairTurns)}, maxCalls ${String(filled.budget.maxCalls)}, sha256 ${sha}`);
  }
  fs.writeFileSync(path.join(outArg, 'plans.json'), `${JSON.stringify({ schema: 'study2b-plans/v1', tasksSha256: parsed.sha256, tasks: tasks.tasks.length, replicates, acceptance: acc !== undefined, plans: summary, totalMaxCalls: total }, null, 1)}\n`, { mode: 0o600 });
  out(`total maxCalls ${String(total)}${refused > 0 ? `; ${String(refused)} plan(s) refused` : ''}`);
  return refused > 0 ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
