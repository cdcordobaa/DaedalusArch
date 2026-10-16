/**
 * Demo of the loop's acceptance-check runner (gate D12; `Docs/v1.3/acceptance-checks.md` §3). No LLM call, no Neo4j.
 *
 * 1. Tapes: the loop replay tapes (`replay-tapes.ts`, `none` arm) run through `runLoop` with the scripted agent, the
 *    stub evaluator and type-check, and the acceptance runner enabled over `experiments/loop-acceptance-demo/`. The
 *    step records' `acceptance` blocks are collected.
 * 2. Reference: each task's demo reference service (`tests/fixtures/loop-acceptance/<task>/`) checked at steps 1-4.
 * 3. Mutilated: a copy of each reference service with one route removed, checked at steps 1-4.
 *
 * Usage (repository root): npx tsx scripts/v1.3/acceptance-demo.ts [--out <file.json>]
 * Prints a table; with --out also writes the records (durations removed, so two runs give the same file).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { EvaluateDeps } from '../../src/mcp-server/evaluate-project.js';
import { acceptanceRunner } from '../lib/loop/acceptance.js';
import type { AcceptanceRunner } from '../lib/loop/acceptance.js';
import { runLoop } from '../lib/loop/loop.js';
import { prepareDryRunWorkDir } from '../lib/loop/main.js';
import { REPLAY_EPOCH, REPLAY_MODEL_ID, ScriptedStepAgent } from '../lib/loop/replay.js';
import { REPLAY_TAPES } from '../lib/loop/replay-tapes.js';
import { stubEvaluator, stubTypechecker } from '../lib/loop/stub.js';
import type { AcceptanceRecord, LoopTask, LoopTasksFile } from '../lib/loop/types.js';

/** Run from the repository root (as every `scripts/v1.3` entry is). */
const REPO = process.cwd();
export const DEMO_TESTS_ROOT = path.join(REPO, 'experiments', 'loop-acceptance-demo');
export const REFERENCE_ROOT = path.join(REPO, 'tests', 'fixtures', 'loop-acceptance');
const TASK_IDS = ['market-vendors', 'shelter-adoptions', 'relief-volunteers'] as const;

/** The route each mutilated copy loses, and the step whose feature it is. */
export const MUTILATIONS: Readonly<Record<string, { readonly route: string; readonly step: number }>> = {
  'market-vendors': { route: "['POST', '/market-days/:id/settlement'", step: 2 },
  'shelter-adoptions': { route: "['POST', '/webhooks/textbridge'", step: 3 },
  'relief-volunteers': { route: "['GET', '/reports/impact'", step: 4 },
};

/** A snapshot directory of a reference service (`server.mjs`, `package.json`, the shared router), optionally mutilated. */
export function referenceSnapshot(taskId: string, into: string, mutilate = false): string {
  fs.mkdirSync(into, { recursive: true });
  for (const f of ['server.mjs', 'package.json']) fs.copyFileSync(path.join(REFERENCE_ROOT, taskId, f), path.join(into, f));
  fs.copyFileSync(path.join(REFERENCE_ROOT, '_router.mjs'), path.join(into, '_router.mjs'));
  if (mutilate) {
    const m = MUTILATIONS[taskId];
    if (m === undefined) throw new Error(`no mutilation for ${taskId}`);
    const file = path.join(into, 'server.mjs');
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(m.route)) throw new Error(`route ${m.route} not in ${taskId}/server.mjs`);
    fs.writeFileSync(file, text.replace(m.route, m.route.replace(/'\/[^']*'$/, "'/removed-by-the-demo'")));
  }
  return into;
}

function stripDurations(r: AcceptanceRecord): Omit<AcceptanceRecord, 'durationMs'> {
  const { durationMs: _d, ...rest } = r;
  return rest;
}

interface Row {
  readonly source: 'tape' | 'reference' | 'mutilated';
  readonly taskId: string;
  readonly step: number;
  readonly record: Omit<AcceptanceRecord, 'durationMs'>;
}

async function tapes(runner: AcceptanceRunner, scratch: string): Promise<Row[]> {
  const rows: Row[] = [];
  const tasksFile = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments', 'loop-pilot', 'pilot-tasks.json'), 'utf8')) as LoopTasksFile;
  const tasks = new Map<string, LoopTask>(tasksFile.tasks.map((t) => [t.id, t]));
  // The `none` arm never calls the MCP tools, so the scripted agent never reaches its evaluate deps.
  const agent = new ScriptedStepAgent(REPLAY_TAPES, () => null, {} as EvaluateDeps);
  const nodeModules = path.join(REPO, 'node_modules');
  for (const tp of REPLAY_TAPES) {
    const r = await runLoop(
      {
        outRoot: path.join(scratch, 'tapes'),
        tasks,
        agent,
        evaluator: stubEvaluator(),
        typechecker: stubTypechecker(),
        prepareWorkDir: (cwd) => {
          const p = prepareDryRunWorkDir(cwd);
          if (p.success) fs.symlinkSync(nodeModules, path.join(cwd, 'node_modules'), 'dir');
          return p;
        },
        skeletonIntact: () => true,
        typecheckCommand: () => 'tsc --noEmit',
        now: () => new Date(REPLAY_EPOCH),
        dryRun: true,
        snapshotDate: REPLAY_EPOCH,
        acceptance: runner,
      },
      { adapterId: 'claude-code-cli', modelId: REPLAY_MODEL_ID, taskId: tp.taskId, arm: 'none', runIndex: 0 },
    );
    if (!r.success) throw new Error(`${tp.taskId}: ${r.errors.map((e) => e.message).join('; ')}`);
    if (r.data.kind !== 'completed') throw new Error(`${tp.taskId}: not run`);
    for (const s of r.data.steps) {
      if (s.acceptance === undefined) throw new Error(`${tp.taskId} step ${String(s.stepIndex + 1)}: no acceptance record`);
      rows.push({ source: 'tape', taskId: tp.taskId, step: s.stepIndex + 1, record: stripDurations(s.acceptance) });
    }
  }
  return rows;
}

async function services(runner: AcceptanceRunner, scratch: string, mutilate: boolean): Promise<Row[]> {
  const rows: Row[] = [];
  for (const taskId of TASK_IDS) {
    const dir = referenceSnapshot(taskId, path.join(scratch, mutilate ? 'mutilated' : 'reference', taskId), mutilate);
    for (let k = 0; k < 4; k++) {
      const r = await runner.run({ taskId, stepIndex: k, workDir: dir });
      rows.push({ source: mutilate ? 'mutilated' : 'reference', taskId, step: k + 1, record: stripDurations(r) });
    }
  }
  return rows;
}

export async function runDemo(): Promise<Row[]> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-demo-'));
  try {
    const runner = acceptanceRunner({ enabled: true, testsRoot: DEMO_TESTS_ROOT, startTimeoutMs: 10_000, timeoutMs: 30_000 });
    return [...(await tapes(runner, scratch)), ...(await services(runner, scratch, false)), ...(await services(runner, scratch, true))];
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? argv[i + 1] : undefined;
  const rows = await runDemo();
  process.stdout.write('| source | task | step | status | files | passed | failed | skipped | errors |\n|---|---|---|---|---|---|---|---|---|\n');
  for (const r of rows) {
    const a = r.record;
    process.stdout.write(`| ${r.source} | ${r.taskId} | ${String(r.step)} | ${a.status} | ${String(a.files.length)} | ${String(a.passed)} | ${String(a.failed)} | ${String(a.skipped)} | ${String(a.errors)} |\n`);
  }
  if (out !== undefined) fs.writeFileSync(path.resolve(out), `${JSON.stringify({ schema: 'loop-acceptance-demo/v1', rows }, null, 2)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('acceptance-demo.ts') === true) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exitCode = 2;
    },
  );
}
