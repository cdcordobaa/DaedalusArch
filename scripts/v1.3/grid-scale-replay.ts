/**
 * Full-grid stub replay at Study 2 scale (Docs/v1.3/grid-scale-replay.md; lib: scripts/v1.3/lib/grid-scale.ts).
 * Tooling, not a measurement: a stub generator, the v1.3 firewall on the in-process Cypher interpreter, no model call.
 * Entry file: no exports.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/grid-scale-replay.ts run --plan <plan.json> --lane i/n --harness-root <abs> --out-root <abs>
 *   npx tsx scripts/v1.3/grid-scale-replay.ts merge --plan <plan.json> --lanes <out1,out2,...> --out <abs>
 *   npx tsx scripts/v1.3/grid-scale-replay.ts verify --plan <plan.json> --lanes <out1,...> --harness-roots <h1,...>
 *                                                    --merged <abs> [--json <file>]
 * `run` re-run with the same arguments resumes (the harness's own resume: complete runs skipped, a partial step
 * discarded and redone).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import { createInterpEvaluator } from '../../src/mcp-server/interp-evaluator.js';
import type { EvaluateDeps } from '../../src/mcp-server/evaluate-project.js';
import { harnessTsconfigPath, typecheckCommand } from '../lib/generators/argv.js';
import { isInsideOrEqual } from '../lib/generators/config.js';
import { writeHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { firewallEvaluator } from '../lib/loop/evaluator.js';
import { RESTARTS_LOG, runLoop, stepRecordPath } from '../lib/loop/loop.js';
import { claimSchedule, prepareDryRunWorkDir } from '../lib/loop/main.js';
import { loadLoopPlan, loopRunId } from '../lib/loop/plan.js';
import { StubStepAgent, stubTypechecker } from '../lib/loop/stub.js';
import type { StepAgent } from '../lib/loop/types.js';
import {
  VIOLATION_STEP,
  checkTurns,
  diskBytes,
  executionOrder,
  gridStubScript,
  idsOf,
  laneSchedule,
  loadLaneRuns,
  mergeLanes,
  parseLane,
  runSignature,
  scheduleBlocks,
} from './lib/grid-scale.js';

const repoRoot = process.cwd();
const [cmd, ...argv] = process.argv.slice(2);
const opt = (name: string): string => {
  const i = argv.indexOf(name);
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (v === undefined || v.startsWith('--')) throw new Error(`${name} is required`);
  return v;
};
const list = (name: string): string[] => opt(name).split(',').map((p) => path.resolve(p));
const sha256File = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function load(local: { harnessRoot?: string; outRoot?: string } = {}) {
  const planFile = path.resolve(repoRoot, opt('--plan'));
  const loaded = loadLoopPlan(planFile, repoRoot, { binary: '/nonexistent/stub-binary', harnessRoot: local.harnessRoot ?? '/nonexistent/h', outRoot: local.outRoot ?? '/nonexistent/o' });
  if (!loaded.success) throw new Error(loaded.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const blocks = scheduleBlocks(loaded.data.plan, loaded.data.tasks.tasks);
  return { planFile, loaded: loaded.data, blocks };
}

async function run(): Promise<void> {
  const lane = parseLane(opt('--lane'));
  const harnessRoot = path.resolve(opt('--harness-root'));
  const outRoot = path.resolve(opt('--out-root'));
  for (const [name, p] of [['--harness-root', harnessRoot], ['--out-root', outRoot]] as const) {
    if (isInsideOrEqual(repoRoot, p)) throw new Error(`${name} must lie outside the repository`);
  }
  if (isInsideOrEqual(harnessRoot, outRoot) || isInsideOrEqual(outRoot, harnessRoot)) throw new Error('--harness-root and --out-root must not nest');
  const { planFile, loaded, blocks } = load({ harnessRoot, outRoot });
  const specs = laneSchedule(blocks, lane);
  const claimed = claimSchedule(outRoot, {
    schema: 'loop-schedule/v1',
    planSha256: sha256File(planFile),
    tasksSha256: sha256File(loaded.tasksPath),
    dryRun: true,
    runs: idsOf(specs),
  });
  if (!claimed.success) throw new Error(claimed.errors.map((e) => e.message).join('\n'));
  const tasks = new Map(loaded.tasks.tasks.map((t) => [t.id, t]));
  const agents = new Map<string, StepAgent>();
  for (const a of loaded.plan.adapters) agents.set(`${a.adapterId}/${a.modelId}`, new StubStepAgent(tasks, { adapterId: a.adapterId, modelId: a.modelId, script: gridStubScript }));
  const deps: EvaluateDeps = { makeGraph: () => { throw new Error('no Neo4j in the grid replay'); }, makePipeline: createPipeline, graphEngine: 'cypher-interp', interp: createInterpEvaluator(), interpTsconfig: true };
  // The work tree has no tsconfig: the pinned per-run tsconfig is written to the lane's harness root before each evaluation.
  const evaluator = firewallEvaluator(path.resolve(repoRoot, loaded.plan.evaluatorSpec ?? ''), {}, deps, (dir, runId) => (runId === undefined ? undefined : writeHarnessTsconfig(harnessRoot, runId, dir)));
  const t0 = Date.now();
  let done = 0;
  for (const spec of specs) {
    const agent = agents.get(`${spec.adapterId}/${spec.modelId}`);
    if (agent === undefined) throw new Error(`no agent for ${spec.adapterId}/${spec.modelId}`);
    const r = await runLoop(
      {
        outRoot,
        tasks,
        agent,
        evaluator,
        typechecker: stubTypechecker(),
        prepareWorkDir: prepareDryRunWorkDir,
        skeletonIntact: () => true,
        typecheckCommand: (runId) => typecheckCommand(harnessRoot, runId),
        now: () => new Date(),
        dryRun: true,
      },
      spec,
    );
    if (!r.success) throw new Error(`${loopRunId(spec)}: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
    done++;
    process.stdout.write(`lane ${String(lane.index)}/${String(lane.of)} ${String(done)}/${String(specs.length)} ${r.data.kind} ${loopRunId(spec)} +${String(Date.now() - t0)}ms\n`);
  }
}

function merge(): void {
  const { planFile, loaded, blocks } = load();
  const res = mergeLanes(path.resolve(opt('--out')), idsOf(blocks.flat()), list('--lanes'), {
    schema: 'loop-schedule/v1',
    planSha256: sha256File(planFile),
    tasksSha256: sha256File(loaded.tasksPath),
    dryRun: true,
  });
  process.stdout.write(`${JSON.stringify(res)}\n`);
  if (res.missing.length > 0) process.exitCode = 1;
}

function verify(): void {
  const { loaded, blocks } = load();
  const lanes = list('--lanes');
  const harnessRoots = list('--harness-roots');
  const merged = path.resolve(opt('--merged'));
  const full = idsOf(blocks.flat());
  const checks: Record<string, { pass: boolean; detail: unknown }> = {};

  // P2: partition and seeded order.
  const laneIds = lanes.map((_, i) => idsOf(laneSchedule(blocks, { index: i + 1, of: lanes.length })));
  const union = laneIds.flat();
  const partition = union.length === full.length && new Set(union).size === full.length && full.every((id) => union.includes(id));
  const loadedLanes = lanes.map((root, i) => loadLaneRuns(root, laneIds[i] ?? []));
  const orderOk = loadedLanes.map((l, i) => JSON.stringify(executionOrder(l.runs)) === JSON.stringify(laneIds[i]));
  const sched = lanes.map((root) => (JSON.parse(fs.readFileSync(path.join(root, 'schedule.json'), 'utf8')) as { runs: string[] }).runs);
  const schedOk = sched.every((s, i) => JSON.stringify(s) === JSON.stringify(laneIds[i]));
  checks.P2_partition_and_order = { pass: partition && orderOk.every(Boolean) && schedOk, detail: { blocks: blocks.length, runs: full.length, perLane: laneIds.map((l) => l.length), executionOrderMatchesSeed: orderOk, laneScheduleMatchesSeed: schedOk } };

  // P1: every run complete.
  const all = loadedLanes.flatMap((l) => l.runs);
  const k = loaded.tasks.tasks[0]?.steps.length ?? 0;
  const incomplete = all.filter((r) => r.run.completedAt === undefined || r.steps.length !== k).map((r) => r.run.runId);
  const missing = loadedLanes.flatMap((l) => l.missing);
  checks.P1_complete = { pass: missing.length === 0 && incomplete.length === 0 && all.length === full.length, detail: { runs: all.length, missing, incomplete } };

  // P3 (S9): no shared roots, and no lane's records name another lane's roots.
  const roots = [...lanes, ...harnessRoots];
  const nested = roots.flatMap((a, i) => roots.filter((b, j) => i !== j && isInsideOrEqual(a, b)).map((b) => `${b} in ${a}`));
  const crossRefs: string[] = [];
  lanes.forEach((_root, i) => {
    const foreign = roots.filter((_, j) => j !== i && j !== lanes.length + i);
    for (const r of loadedLanes[i]?.runs ?? []) {
      const text = [fs.readFileSync(path.join(r.dir, 'run.json'), 'utf8'), ...r.steps.map((s) => JSON.stringify(s))].join('\n');
      for (const f of foreign) if (text.includes(f)) crossRefs.push(`${r.run.runId} names ${f}`);
    }
  });
  const tsconfigsOk = harnessRoots.every((h, i) => (laneIds[i] ?? []).every((id) => fs.existsSync(harnessTsconfigPath(h, id))));
  checks.P3_S9_lane_isolation = { pass: nested.length === 0 && crossRefs.length === 0 && tsconfigsOk, detail: { nested, crossRefs: crossRefs.slice(0, 10), crossRefCount: crossRefs.length, perRunTsconfigInOwnHarnessRoot: tsconfigsOk } };

  // P4: resume produced no duplicate or missing turn.
  const turnProblems = all.flatMap(checkTurns);
  const restarts = all.filter((r) => fs.existsSync(path.join(r.dir, RESTARTS_LOG))).map((r) => ({ runId: r.run.runId, lines: fs.readFileSync(path.join(r.dir, RESTARTS_LOG), 'utf8').trim().split('\n').length }));
  checks.P4_resume = { pass: turnProblems.length === 0, detail: { turnProblems: turnProblems.slice(0, 10), turnProblemCount: turnProblems.length, runsWithRestarts: restarts } };

  // P5: determinism across models and replicates of one task × arm (the interrupted run included).
  const groups = new Map<string, Set<string>>();
  for (const r of all) {
    const key = `${r.run.spec.taskId}/${r.run.spec.arm}`;
    const g = groups.get(key) ?? new Set<string>();
    g.add(runSignature(r));
    groups.set(key, g);
  }
  const divergent = [...groups].filter(([, g]) => g.size !== 1).map(([key]) => key);
  checks.P5_deterministic = { pass: divergent.length === 0 && groups.size === loaded.tasks.tasks.length * loaded.plan.arms.length, detail: { groups: groups.size, divergent } };

  // P6: the gate fires at the planted step only, and its repair clears it; the other arms keep the violation.
  const gateBad: string[] = [];
  const otherBad: string[] = [];
  const evalErrors: string[] = [];
  for (const r of all) {
    for (const s of r.steps) {
      for (const t of s.turns) if (t.snapshot.evaluation === null) evalErrors.push(`${r.run.runId} step ${String(s.stepIndex + 1)}: ${t.snapshot.evaluationError?.code ?? 'no evaluation'}`);
      const blocking = s.turns[0]?.snapshot.evaluation?.blockingViolationCount ?? -1;
      if (r.run.spec.arm === 'gate') {
        const want = s.stepIndex === VIOLATION_STEP;
        if ((s.repair?.attempted === true) !== want || (want && s.repair?.cleared !== true) || (!want && blocking !== 0)) gateBad.push(`${r.run.runId} step ${String(s.stepIndex + 1)}`);
      } else if ((blocking > 0) !== s.stepIndex >= VIOLATION_STEP) otherBad.push(`${r.run.runId} step ${String(s.stepIndex + 1)} blocking ${String(blocking)}`);
    }
  }
  checks.P6_gate_fires = { pass: gateBad.length === 0 && otherBad.length === 0 && evalErrors.length === 0, detail: { gateBad: gateBad.slice(0, 10), otherBad: otherBad.slice(0, 10), evalErrors: evalErrors.slice(0, 10), evalErrorCount: evalErrors.length } };

  // Merged out-root links every run.
  const linked = full.filter((id) => fs.existsSync(path.join(merged, 'runs', ...id.split('/'), 'run.json'))).length;
  checks.merged_out_root = { pass: linked === full.length, detail: { linked } };

  // Measures (no threshold).
  const stepSizes = all.flatMap((r) => r.steps.map((s) => fs.statSync(stepRecordPath(r.dir, s.stepIndex)).size)).sort((a, b) => a - b);
  const snapshots = all.reduce((n, r) => n + r.steps.reduce((m, s) => m + s.turns.length, 0), 0);
  const gitBytes = all.reduce((n, r) => n + diskBytes(path.join(r.dir, 'snapshots.git')), 0);
  const laneBytes = lanes.map((l) => diskBytes(l));
  const harnessBytes = harnessRoots.map((h) => diskBytes(h));
  const evalMs = all.flatMap((r) => r.steps.flatMap((s) => s.turns.map((t) => t.snapshot.evaluation?.durationMs ?? 0))).sort((a, b) => a - b);
  const q = (xs: number[], p: number): number => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
  const measures = {
    steps: stepSizes.length,
    snapshots,
    repairTurns: snapshots - stepSizes.length,
    stepRecordBytes: { median: q(stepSizes, 0.5), max: stepSizes[stepSizes.length - 1] ?? 0, total: stepSizes.reduce((a, b) => a + b, 0) },
    snapshotStoreBytes: { total: gitBytes, perSnapshot: Math.round(gitBytes / Math.max(1, snapshots)), perRun: Math.round(gitBytes / Math.max(1, all.length)) },
    laneOutRootBytes: laneBytes,
    harnessRootBytes: harnessBytes,
    evaluateDurationMs: { median: q(evalMs, 0.5), p95: q(evalMs, 0.95), max: evalMs[evalMs.length - 1] ?? 0 },
  };
  const result = { pass: Object.values(checks).every((c) => c.pass), checks, measures };
  const text = `${JSON.stringify(result, null, 2)}\n`;
  const jsonOut = argv.includes('--json') ? opt('--json') : '';
  if (jsonOut !== '') fs.writeFileSync(jsonOut, text);
  process.stdout.write(text);
  if (!result.pass) process.exitCode = 1;
}

(async () => {
  if (cmd === 'run') await run();
  else if (cmd === 'merge') merge();
  else if (cmd === 'verify') verify();
  else throw new Error('usage: grid-scale-replay.ts run|merge|verify ... (see the file header)');
})().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
