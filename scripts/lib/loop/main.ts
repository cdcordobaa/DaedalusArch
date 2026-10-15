/**
 * `main` of `scripts/loop-harness-cli.ts`: the firewall-in-the-loop multi-step generation grid.
 *
 * Usage (repository root):
 *   npx tsx scripts/loop-harness-cli.ts --plan <plan.json> [--dry-run] [--binary <abs>] [--harness-root <abs>]
 *                                       [--out-root <abs>] [--codex-home <abs>] [--codex-user-home <abs>]
 *   npx tsx scripts/loop-harness-cli.ts --help
 *
 * `--dry-run` replaces the generator, the firewall and the type-check with the stubs of `stub.ts`: the whole loop
 * (schedule, work directories, snapshots, measures, the gate's repair turn, resume) runs with no model call, no Neo4j
 * and no skeleton install. Without it the Claude Code / Codex step agents run under the plan's pins with the E1
 * confinement, the skeleton install is prepared (`ensureHarness`), and every snapshot is type-checked with the E1
 * type-check of record and evaluated by `evaluate_project` (v1.3 scoring) on a scratch Neo4j.
 *
 * The grid writes `<outRoot>/schedule.json` (the plan and tasks file sha256 and the seeded order). Re-running the same
 * plan resumes: complete runs are skipped, a run stopped mid-step restarts that step from the last snapshot. A
 * schedule.json from a different plan or tasks file stops the grid. Exit codes: 0 grid completed, 1 a CLI is not
 * available, 2 usage, plan or harness error.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import { typecheckCommand } from '../generators/argv.js';
import { codexConfigFromPlan } from '../generators/codex-plan.js';
import type { CodexHomes } from '../generators/codex-plan.js';
import { createGeneratorCliConfig, isInsideOrEqual } from '../generators/config.js';
import { realSleep, systemClock } from '../generators/retry.js';
import type { Clock, Sleeper } from '../generators/retry.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir } from '../generators/skeleton.js';
import type { SkeletonInstall } from '../generators/skeleton.js';
import { CODEX_CLI_ADAPTER_ID_VALUE } from '../generators/types.js';
import { ClaudeStepAgent, CodexStepAgent } from './agents.js';
import { firewallEvaluator, harnessTypechecker } from './evaluator.js';
import { runLoop } from './loop.js';
import type { LoopContext, LoopRunResult } from './loop.js';
import { loadLoopPlan, loopRunId, scheduleLoopRuns } from './plan.js';
import type { LoadedPlan, LocalOverrides } from './plan.js';
import { StubStepAgent, stubEvaluator, stubTypechecker } from './stub.js';
import type { StepAgent, StepEvaluator, StepTypechecker } from './types.js';

export const LOOP_SCHEDULE_JSON = 'schedule.json';

export const LOOP_USAGE = [
  'usage: npx tsx scripts/loop-harness-cli.ts --plan <plan.json> [--dry-run] [--binary <abs>] [--harness-root <abs>]',
  '                                          [--out-root <abs>] [--codex-home <abs>] [--codex-user-home <abs>]',
  '       npx tsx scripts/loop-harness-cli.ts --help',
  '',
  'Runs the multi-step firewall-in-the-loop grid: each run applies the k steps of a task to one work directory under',
  'an arm (none | daedalus-mcp | gate), snapshotting, type-checking and evaluating after every step. Re-running the',
  'same plan resumes. --dry-run uses a stub generator, stub firewall and stub type-check (no model, no Neo4j).',
  'Plan fields "<local>" (binary, harnessRoot, outRoot) come from --binary, --harness-root and --out-root.',
  '',
].join('\n');

export interface LoopMainDeps {
  readonly runner: ProcessRunner;
  readonly clock: Clock;
  readonly sleep: Sleeper;
  readonly now: () => Date;
  readonly parentEnv: NodeJS.ProcessEnv;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** Production wiring of `evaluate_project` (Neo4j); loaded lazily so a dry run never touches it. */
  readonly evaluateDeps?: () => Promise<EvaluateDeps>;
}

export function defaultLoopDeps(): LoopMainDeps {
  return {
    runner: new NodeProcessRunner(),
    clock: systemClock,
    sleep: realSleep,
    now: () => new Date(),
    parentEnv: process.env,
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
    evaluateDeps: async () => {
      const { buildContext } = await import('../../../src/mcp-server/context.js');
      return buildContext({}, process.env).evaluateDeps;
    },
  };
}

interface ParsedArgs {
  readonly help: boolean;
  readonly dryRun: boolean;
  readonly plan?: string;
  readonly local: LocalOverrides;
  readonly codexHomes: CodexHomes;
}

export function parseLoopArgs(argv: readonly string[]): DomainResult<ParsedArgs> {
  let help = false;
  let dryRun = false;
  let plan: string | undefined;
  const local: { binary?: string; harnessRoot?: string; outRoot?: string } = {};
  const homes: { codexHome?: string; userHome?: string } = {};
  const value = (i: number): string | undefined => {
    const v = argv[i + 1];
    return v !== undefined && !v.startsWith('--') ? v : undefined;
  };
  const set: Readonly<Record<string, (v: string) => void>> = {
    '--plan': (v) => (plan = v),
    '--binary': (v) => (local.binary = v),
    '--harness-root': (v) => (local.harnessRoot = v),
    '--out-root': (v) => (local.outRoot = v),
    '--codex-home': (v) => (homes.codexHome = v),
    '--codex-user-home': (v) => (homes.userHome = v),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    const v = value(i);
    const setter = set[a];
    if (a === '--help' || a === '-h') help = true;
    else if (a === '--dry-run') dryRun = true;
    else if (setter !== undefined && v !== undefined) {
      setter(v);
      i++;
    } else return DomainResult.fail([{ code: 'LOOP_USAGE', message: `unexpected argument ${JSON.stringify(a)}` }]);
  }
  if (!help && plan === undefined) return DomainResult.fail([{ code: 'LOOP_USAGE', message: '--plan <file> is required' }]);
  return DomainResult.ok({ help, dryRun, local, codexHomes: homes, ...(plan !== undefined ? { plan } : {}) });
}

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

interface ScheduleFile {
  readonly schema: 'loop-schedule/v1';
  readonly planSha256: string;
  readonly tasksSha256: string;
  readonly dryRun: boolean;
  readonly runs: readonly string[];
}

/** Writes `schedule.json`, or checks that an existing one belongs to the same plan, tasks and mode. */
export function claimSchedule(outRoot: string, schedule: ScheduleFile): DomainResult<void> {
  const file = path.join(outRoot, LOOP_SCHEDULE_JSON);
  if (fs.existsSync(file)) {
    let prior: Partial<ScheduleFile> = {};
    try {
      prior = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ScheduleFile>;
    } catch {
      prior = {};
    }
    const same =
      prior.planSha256 === schedule.planSha256 &&
      prior.tasksSha256 === schedule.tasksSha256 &&
      prior.dryRun === schedule.dryRun &&
      JSON.stringify(prior.runs) === JSON.stringify(schedule.runs);
    return same
      ? DomainResult.ok(undefined)
      : DomainResult.fail([{ code: 'LOOP_SCHEDULE_MISMATCH', message: `${file} belongs to another plan, tasks file or mode; use a fresh outRoot` }]);
  }
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(schedule, null, 2)}\n`);
  return DomainResult.ok(undefined);
}

function report(deps: LoopMainDeps, errors: readonly DomainError[]): number {
  deps.err(`${scrubSecrets(errors.map((e) => `${e.code}: ${e.message}`).join('\n'), [])}\n`);
  return 2;
}

/** The dry-run skeleton: a placeholder `package.json`, no install. */
export function prepareDryRunWorkDir(cwd: string): DomainResult<void> {
  if (fs.existsSync(cwd) && fs.readdirSync(cwd).length > 0) {
    return DomainResult.fail([{ code: 'GEN_CWD_NOT_EMPTY', message: 'the run cwd must be fresh and empty' }]);
  }
  fs.mkdirSync(cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'package.json'), '{ "name": "loop-dry-run", "private": true }\n');
  return DomainResult.ok(undefined);
}

interface Wiring {
  readonly agents: ReadonlyMap<string, StepAgent>;
  readonly evaluator: StepEvaluator;
  readonly typechecker: StepTypechecker;
  readonly prepareWorkDir: LoopContext['prepareWorkDir'];
  readonly skeletonIntact: LoopContext['skeletonIntact'];
}

function agentKey(adapterId: string, modelId: string): string {
  return `${adapterId}/${modelId}`;
}

function dryRunWiring(loaded: LoadedPlan): Wiring {
  const tasks = new Map(loaded.tasks.tasks.map((t) => [t.id, t]));
  const agents = new Map<string, StepAgent>();
  for (const a of loaded.plan.adapters) agents.set(agentKey(a.adapterId, a.modelId), new StubStepAgent(tasks, { adapterId: a.adapterId, modelId: a.modelId }));
  return { agents, evaluator: stubEvaluator(), typechecker: stubTypechecker(), prepareWorkDir: prepareDryRunWorkDir, skeletonIntact: () => true };
}

async function liveWiring(loaded: LoadedPlan, repoRoot: string, args: ParsedArgs, deps: LoopMainDeps): Promise<DomainResult<Wiring>> {
  const { plan } = loaded;
  if (isInsideOrEqual(repoRoot, plan.outRoot)) return DomainResult.fail([{ code: 'LOOP_PLAN_INVALID', message: 'outRoot must lie outside the repository' }]);
  if (deps.evaluateDeps === undefined) return DomainResult.fail([{ code: 'LOOP_NO_EVALUATOR', message: 'no evaluate_project wiring' }]);
  const ready = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
  if (!ready.success) return DomainResult.fail(ready.errors);
  const install: SkeletonInstall = ready.data.install;
  const common = { runner: deps.runner, parentEnv: deps.parentEnv, clock: deps.clock, sleep: deps.sleep, ...(plan.daedalus !== undefined ? { daedalus: plan.daedalus } : {}) };
  const agents = new Map<string, StepAgent>();
  for (const a of plan.adapters) {
    if (a.adapterId === CODEX_CLI_ADAPTER_ID_VALUE) {
      const c = codexConfigFromPlan(plan, a.modelId, repoRoot, args.codexHomes);
      if (!c.success) return DomainResult.fail(c.errors);
      const agent = new CodexStepAgent(c.data, { ...common, repoRoot });
      if (!(await agent.isAvailable())) return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the codex CLI (pinned version) is not available' }]);
      agents.set(agentKey(a.adapterId, a.modelId), agent);
      continue;
    }
    const c = createGeneratorCliConfig(
      { binary: plan.binary, modelId: a.modelId, outputRoot: plan.outRoot, harnessRoot: plan.harnessRoot, allowBash: plan.allowBash, ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}) },
      repoRoot,
    );
    if (!c.success) return DomainResult.fail(c.errors);
    const agent = new ClaudeStepAgent(c.data, common);
    if (!(await agent.isAvailable())) return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the claude CLI is not available at the plan binary path' }]);
    agents.set(agentKey(a.adapterId, a.modelId), agent);
  }
  const evaluateDeps = await deps.evaluateDeps();
  return DomainResult.ok({
    agents,
    evaluator: firewallEvaluator(path.resolve(repoRoot, plan.evaluatorSpec), deps.parentEnv, evaluateDeps),
    typechecker: harnessTypechecker(deps.runner, plan.harnessRoot),
    prepareWorkDir: (cwd) => prepareCellDir(install, repoRoot, cwd),
    skeletonIntact: (cwd) => checkSkeletonIntact(install, repoRoot, cwd).skeletonIntact,
  });
}

/** Runs the grid of a loaded plan with a given wiring; returns every run's result. */
export async function runLoopGrid(
  loaded: LoadedPlan,
  wiring: Wiring,
  options: { readonly dryRun: boolean; readonly now: () => Date; readonly planSha256: string; readonly tasksSha256: string; readonly log?: (line: string) => void },
): Promise<DomainResult<readonly LoopRunResult[]>> {
  const { plan } = loaded;
  const specs = scheduleLoopRuns(plan, loaded.tasks.tasks);
  const claimed = claimSchedule(plan.outRoot, {
    schema: 'loop-schedule/v1',
    planSha256: options.planSha256,
    tasksSha256: options.tasksSha256,
    dryRun: options.dryRun,
    runs: specs.map(loopRunId),
  });
  if (!claimed.success) return DomainResult.fail(claimed.errors);
  const tasks = new Map(loaded.tasks.tasks.map((t) => [t.id, t]));
  const results: LoopRunResult[] = [];
  for (const spec of specs) {
    const agent = wiring.agents.get(agentKey(spec.adapterId, spec.modelId));
    if (agent === undefined) return DomainResult.fail([{ code: 'LOOP_AGENT_MISSING', message: `no agent for ${spec.adapterId}/${spec.modelId}` }]);
    const r = await runLoop(
      {
        outRoot: plan.outRoot,
        tasks,
        agent,
        evaluator: wiring.evaluator,
        typechecker: wiring.typechecker,
        prepareWorkDir: wiring.prepareWorkDir,
        skeletonIntact: wiring.skeletonIntact,
        typecheckCommand: (runId) => typecheckCommand(plan.harnessRoot, runId),
        now: options.now,
        dryRun: options.dryRun,
        ...(options.log !== undefined ? { log: options.log } : {}),
      },
      spec,
    );
    if (!r.success) return DomainResult.fail(r.errors);
    results.push(r.data);
  }
  return DomainResult.ok(results);
}

export async function main(argv: readonly string[], repoRoot: string, depsIn?: LoopMainDeps): Promise<number> {
  const deps = depsIn ?? defaultLoopDeps();
  const args = parseLoopArgs(argv);
  if (!args.success) {
    deps.err(LOOP_USAGE);
    return report(deps, args.errors);
  }
  if (args.data.help) {
    deps.out(LOOP_USAGE);
    return 0;
  }
  const planFile = path.resolve(repoRoot, args.data.plan ?? '');
  const loaded = loadLoopPlan(planFile, repoRoot, args.data.local);
  if (!loaded.success) return report(deps, loaded.errors);
  if (!path.isAbsolute(loaded.data.plan.outRoot)) return report(deps, [{ code: 'LOOP_PLAN_INVALID', message: 'outRoot must be absolute' }]);
  let wiring: Wiring;
  if (args.data.dryRun) wiring = dryRunWiring(loaded.data);
  else {
    const live = await liveWiring(loaded.data, repoRoot, args.data, deps);
    if (!live.success) {
      const unavailable = live.errors.some((e) => e.code === 'LOOP_CLI_UNAVAILABLE');
      report(deps, live.errors);
      return unavailable ? 1 : 2;
    }
    wiring = live.data;
  }
  const grid = await runLoopGrid(loaded.data, wiring, {
    dryRun: args.data.dryRun,
    now: deps.now,
    planSha256: sha256File(planFile),
    tasksSha256: sha256File(loaded.data.tasksPath),
    log: (line) => {
      deps.out(`${line}\n`);
    },
  });
  if (!grid.success) return report(deps, grid.errors);
  const completed = grid.data.filter((r) => r.kind === 'completed').length;
  deps.out(`${JSON.stringify({ outRoot: loaded.data.plan.outRoot, dryRun: args.data.dryRun, runs: grid.data.length, completed, skipped: grid.data.length - completed }, null, 2)}\n`);
  return 0;
}
