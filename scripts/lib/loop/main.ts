/**
 * `main` of `scripts/loop-harness-cli.ts`: the firewall-in-the-loop multi-step generation grid.
 *
 * Usage (repository root):
 *   npx tsx scripts/loop-harness-cli.ts --plan <plan.json> [--dry-run] [--binary <abs>] [--harness-root <abs>]
 *                                       [--out-root <abs>] [--codex-home <abs>] [--codex-user-home <abs>]
 *                                       [--claude-config-dir <abs>]
 *                                       [--engine neo4j|cypher-interp|both]
 *   npx tsx scripts/loop-harness-cli.ts --help
 *
 * `--dry-run` replaces the generator, the firewall and the type-check with the stubs of `stub.ts`: the whole loop
 * (schedule, work directories, snapshots, measures, the gate's repair turn, resume) runs with no model call, no Neo4j
 * and no skeleton install. Without it the Claude Code / Codex step agents run under the plan's pins with the E1
 * confinement, the skeleton install is prepared (`ensureHarness`), and every snapshot is type-checked with the E1
 * type-check of record and evaluated by `evaluate_project` (v1.3 scoring) on a scratch Neo4j.
 *
 * A plan with `taskProfiles` gives each task its style frame and its spec (`style.ts`, `specs.ts`). In a dry run the
 * stub generator writes each task's style layout, the stub firewall stands in for every spec, the static spec files
 * are still read and hashed, and the DDD spec is really inferred by the ISE and frozen after step 1 (no model, no
 * Neo4j), so the dry run exercises the whole per-task path.
 *
 * The grid writes `<outRoot>/schedule.json` (the plan and tasks file sha256 and the seeded order). Re-running the same
 * plan resumes: complete runs are skipped, a run stopped mid-step restarts that step from the last snapshot. A
 * schedule.json from a different plan or tasks file stops the grid. Exit codes: 0 grid completed, 1 a CLI is not
 * available or its version differs from the plan's `cliVersion`, 2 usage, plan or harness error.
 *
 * A live plan with `adapters[].cliVersion` or `generatorIsolation` probes every adapter before the skeleton install, so
 * a version mismatch or a failed isolation check stops the grid before any work (`Docs/v1.3/loop-isolation.md`). Any
 * other plan keeps the E1 order and availability check unchanged.
 *
 * `--engine` (or the plan's `engine`; the flag wins) picks the evaluator's graph engine (`engine-tee.ts`,
 * `Docs/v1.3/loop-engine-tee.md`): `both` keeps Neo4j as the engine of record, re-evaluates every snapshot on the
 * in-process interpreter and records parity. Absent = `neo4j`, the reference engine: a live grid never inherits the
 * NEO4J_URI default of `engine-default.ts`, and every evaluation records its engine (`engineOfRecord`). A dry run
 * ignores it (stubs).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
import { acceptanceRunner } from './acceptance.js';
import { ClaudeStepAgent, CodexStepAgent } from './agents.js';
import { checkIsolationPaths } from './isolation.js';
import { firewallEvaluator, harnessSnapshotTsconfig, harnessTypechecker } from './evaluator.js';
import { evaluatorForEngine, parseLoopEngine } from './engine-tee.js';
import type { LoopEngine } from './engine-tee.js';
import { gateEvaluationFailures, runLoop } from './loop.js';
import type { LoopContext, LoopRunResult, TaskProfile } from './loop.js';
import { loadLoopPlan, loopRunId, mcpSpecCheck, planCallBudget, scheduleLoopRuns, SPEC_SHA_ENV } from './plan.js';
import type { LoadedPlan, LocalOverrides } from './plan.js';
import { iseDddFreezer } from './specs.js';
import type { SpecFreezer } from './specs.js';
import { styleFrame } from './style.js';
import type { LoopStyle } from './style.js';
import { CLEAN_STUB_LAYOUT, StubStepAgent, layoutStubScript, stubEvaluator, stubTypechecker } from './stub.js';
import type { StubLayout } from './stub.js';
import type { StepAgent, StepEvaluator, StepTypechecker } from './types.js';

export const LOOP_SCHEDULE_JSON = 'schedule.json';

export const LOOP_USAGE = [
  'usage: npx tsx scripts/loop-harness-cli.ts --plan <plan.json> [--dry-run] [--binary <abs>] [--harness-root <abs>]',
  '                                          [--out-root <abs>] [--codex-home <abs>] [--codex-user-home <abs>]',
  '                                          [--claude-config-dir <abs>]',
  '                                          [--engine neo4j|cypher-interp|both]',
  '       npx tsx scripts/loop-harness-cli.ts --help',
  '',
  'Runs the multi-step firewall-in-the-loop grid: each run applies the k steps of a task to one work directory under',
  'an arm (none | daedalus-mcp | gate), snapshotting, type-checking and evaluating after every step. Re-running the',
  'same plan resumes. --dry-run uses a stub generator, stub firewall and stub type-check (no model, no Neo4j).',
  'Plan fields "<local>" (binary, harnessRoot, outRoot) come from --binary, --harness-root and --out-root.',
  '--engine (or the plan\'s "engine") picks the evaluator\'s graph engine; both = Neo4j of record plus an',
  'interpreter parity check on every snapshot. Absent = the default wiring.',
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
  /** `--engine`; absent = the plan's `engine`, else the default wiring. */
  readonly engine?: LoopEngine;
}

export function parseLoopArgs(argv: readonly string[]): DomainResult<ParsedArgs> {
  let help = false;
  let dryRun = false;
  let plan: string | undefined;
  let engine: string | undefined;
  const local: { binary?: string; harnessRoot?: string; outRoot?: string; claudeConfigDir?: string } = {};
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
    '--claude-config-dir': (v) => (local.claudeConfigDir = v),
    '--engine': (v) => (engine = v),
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
  const parsedEngine = engine !== undefined ? parseLoopEngine(engine) : undefined;
  if (engine !== undefined && parsedEngine === undefined) return DomainResult.fail([{ code: 'LOOP_USAGE', message: `--engine must be neo4j, cypher-interp or both, not ${JSON.stringify(engine)}` }]);
  return DomainResult.ok({ help, dryRun, local, codexHomes: homes, ...(plan !== undefined ? { plan } : {}), ...(parsedEngine !== undefined ? { engine: parsedEngine } : {}) });
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
  /** The evaluator engine when one was chosen (absent = the default wiring); a resume must keep it. */
  readonly engine?: LoopEngine;
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
      prior.engine === schedule.engine &&
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
  readonly profiles?: ReadonlyMap<string, TaskProfile>;
  readonly typechecker: StepTypechecker;
  readonly prepareWorkDir: LoopContext['prepareWorkDir'];
  readonly skeletonIntact: LoopContext['skeletonIntact'];
}

function agentKey(adapterId: string, modelId: string): string {
  return `${adapterId}/${modelId}`;
}

/** An evaluator for a task that has neither a profile nor a default spec (never reached: the plan check forbids it). */
function noSpecEvaluator(): StepEvaluator {
  return { id: 'no-spec', evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LOOP_NO_SPEC', message: 'the plan names no spec for this task' }])) };
}

/** The per-task frames and evaluations of a plan; `evaluatorOf` builds the evaluator of a spec file (absolute path). */
export function buildProfiles(
  loaded: LoadedPlan,
  repoRoot: string,
  evaluatorOf: (specFile: string) => StepEvaluator,
  freeze: SpecFreezer,
): DomainResult<ReadonlyMap<string, TaskProfile> | undefined> {
  const entries = loaded.plan.taskProfiles;
  if (entries === undefined) return DomainResult.ok(undefined);
  const out = new Map<string, TaskProfile>();
  for (const [taskId, p] of Object.entries(entries)) {
    const contexts = p.contexts ?? [];
    let frame;
    try {
      frame = styleFrame(repoRoot, p.style, contexts);
    } catch (e) {
      return DomainResult.fail([{ code: 'LOOP_STYLE_PRESET', message: `${taskId}: ${e instanceof Error ? e.message : String(e)}` }]);
    }
    if ((p.specMode ?? 'static') === 'ise-step1') {
      out.set(taskId, { frame, evaluation: { kind: 'frozen-after-step-1', contexts, freeze, evaluatorFor: evaluatorOf } });
      continue;
    }
    const specPath = p.evaluatorSpec ?? '';
    const abs = path.resolve(repoRoot, specPath);
    if (!fs.existsSync(abs)) return DomainResult.fail([{ code: 'LOOP_PLAN_INVALID', message: `${taskId}: evaluator spec ${specPath} not found` }]);
    out.set(taskId, { frame, evaluation: { kind: 'static', specPath, specSha256: sha256File(abs), evaluator: evaluatorOf(abs) } });
  }
  return DomainResult.ok(out);
}

/** Where the dry-run stub writes a step of a task of the given style (DDD: the declared contexts in turn, one folder per aggregate, every context at step 1). */
export function stubLayoutFor(style: LoopStyle | undefined, contextRoots: readonly string[], stepIndex: number): StubLayout {
  if (style === 'hexagonal') return { domain: 'src/domain', application: 'src/application', infrastructure: 'src/adapters/outbound' };
  if (style === 'ddd' && contextRoots.length > 0) {
    const roots = contextRoots.map((r) => r.replace(/\/$/, ''));
    const root = roots[stepIndex % roots.length] ?? '';
    const also = stepIndex === 0 ? roots.filter((r) => r !== root).map((r) => `${r}/domain`) : [];
    return { domain: `${root}/domain`, application: `${root}/application`, infrastructure: `${root}/infrastructure`, aggregateFolders: true, ...(also.length > 0 ? { alsoDomains: also } : {}) };
  }
  return CLEAN_STUB_LAYOUT;
}

function dryRunWiring(loaded: LoadedPlan, repoRoot: string): DomainResult<Wiring> {
  const tasks = new Map(loaded.tasks.tasks.map((t) => [t.id, t]));
  const profiles = loaded.plan.taskProfiles ?? {};
  const script = layoutStubScript((taskId, stepIndex) => {
    const p = profiles[taskId];
    return stubLayoutFor(p?.style, (p?.contexts ?? []).map((c) => c.root), stepIndex);
  });
  const agents = new Map<string, StepAgent>();
  for (const a of loaded.plan.adapters) agents.set(agentKey(a.adapterId, a.modelId), new StubStepAgent(tasks, { adapterId: a.adapterId, modelId: a.modelId, script }));
  const built = buildProfiles(loaded, repoRoot, () => stubEvaluator(), iseDddFreezer(repoRoot));
  if (!built.success) return DomainResult.fail(built.errors);
  return DomainResult.ok({
    agents,
    evaluator: stubEvaluator(),
    ...(built.data !== undefined ? { profiles: built.data } : {}),
    typechecker: stubTypechecker(),
    prepareWorkDir: prepareDryRunWorkDir,
    skeletonIntact: () => true,
  });
}

/** The engine of a live grid: `--engine`, else the plan's `engine`, else `neo4j` (never the NEO4J_URI default). */
export function liveEngine(flag: LoopEngine | undefined, plan: LoopEngine | undefined): LoopEngine {
  return flag ?? plan ?? 'neo4j';
}

async function liveWiring(loaded: LoadedPlan, repoRoot: string, args: ParsedArgs, deps: LoopMainDeps): Promise<DomainResult<Wiring>> {
  const { plan } = loaded;
  if (isInsideOrEqual(repoRoot, plan.outRoot)) return DomainResult.fail([{ code: 'LOOP_PLAN_INVALID', message: 'outRoot must lie outside the repository' }]);
  if (deps.evaluateDeps === undefined) return DomainResult.fail([{ code: 'LOOP_NO_EVALUATOR', message: 'no evaluate_project wiring' }]);
  // R23: the MCP arm's advice and the score must come from the same spec.
  const specMatch = mcpSpecCheck(plan, repoRoot);
  if (!specMatch.success) return DomainResult.fail(specMatch.errors);
  const isolation = plan.generatorIsolation !== undefined ? { configDir: plan.generatorIsolation.claudeConfigDir } : undefined;
  if (isolation !== undefined) {
    const where = { repoRoot, outRoot: plan.outRoot, harnessRoot: plan.harnessRoot, realHome: deps.parentEnv.HOME ?? os.homedir() };
    const problems = checkIsolationPaths(isolation, where);
    if (problems.length > 0) return DomainResult.fail(problems);
  }
  // A plan with a pin or isolation probes its adapters before the skeleton install; any other plan keeps the old order.
  const pinned = isolation !== undefined || plan.adapters.some((a) => a.cliVersion !== undefined);
  let install: SkeletonInstall | undefined;
  if (!pinned) {
    const ready = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
    if (!ready.success) return DomainResult.fail(ready.errors);
    install = ready.data.install;
  }
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
    const agent = new ClaudeStepAgent(c.data, { ...common, ...(a.cliVersion !== undefined ? { cliVersion: a.cliVersion } : {}), ...(isolation !== undefined ? { isolation } : {}) });
    if (pinned) {
      const probed = await agent.probe();
      if (!probed.success) return DomainResult.fail(probed.errors);
    } else if (!(await agent.isAvailable())) return DomainResult.fail([{ code: 'LOOP_CLI_UNAVAILABLE', message: 'the claude CLI is not available at the plan binary path' }]);
    agents.set(agentKey(a.adapterId, a.modelId), agent);
  }
  if (install === undefined) {
    const ready = await ensureHarness(deps.runner, repoRoot, plan.harnessRoot);
    if (!ready.success) return DomainResult.fail(ready.errors);
    install = ready.data.install;
  }
  const harness: SkeletonInstall = install;
  const evaluateDeps = await deps.evaluateDeps();
  const engine = liveEngine(args.engine, plan.engine);
  const onMismatch = (runId: string | undefined, _dir: string, p: { status: string; diff?: unknown; checkError?: unknown }): void => {
    deps.err(`PARITY ${p.status} ${runId ?? '?'}: ${JSON.stringify(p.diff ?? p.checkError ?? {})}\n`);
  };
  const evaluatorOf = (specFile: string): StepEvaluator =>
    evaluatorForEngine(engine, evaluateDeps, deps.parentEnv, (d, env) => firewallEvaluator(specFile, env, d, harnessSnapshotTsconfig(plan.harnessRoot)), { onMismatch });
  const profiles = buildProfiles(loaded, repoRoot, evaluatorOf, iseDddFreezer(repoRoot));
  if (!profiles.success) return DomainResult.fail(profiles.errors);
  return DomainResult.ok({
    agents,
    evaluator: plan.evaluatorSpec !== undefined ? evaluatorOf(path.resolve(repoRoot, plan.evaluatorSpec)) : noSpecEvaluator(),
    ...(profiles.data !== undefined ? { profiles: profiles.data } : {}),
    typechecker: harnessTypechecker(deps.runner, plan.harnessRoot),
    prepareWorkDir: (cwd) => prepareCellDir(harness, repoRoot, cwd),
    skeletonIntact: (cwd) => checkSkeletonIntact(harness, repoRoot, cwd).skeletonIntact,
  });
}

/** Runs the grid of a loaded plan with a given wiring; returns every run's result. */
export async function runLoopGrid(
  loaded: LoadedPlan,
  wiring: Wiring,
  options: { readonly dryRun: boolean; readonly now: () => Date; readonly planSha256: string; readonly tasksSha256: string; readonly log?: (line: string) => void; readonly engine?: LoopEngine },
): Promise<DomainResult<readonly LoopRunResult[]>> {
  const { plan } = loaded;
  const specs = scheduleLoopRuns(plan, loaded.tasks.tasks);
  const claimed = claimSchedule(plan.outRoot, {
    schema: 'loop-schedule/v1',
    planSha256: options.planSha256,
    tasksSha256: options.tasksSha256,
    dryRun: options.dryRun,
    runs: specs.map(loopRunId),
    ...(options.engine !== undefined ? { engine: options.engine } : {}),
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
        ...(wiring.profiles !== undefined ? { profiles: wiring.profiles } : {}),
        typechecker: wiring.typechecker,
        prepareWorkDir: wiring.prepareWorkDir,
        skeletonIntact: wiring.skeletonIntact,
        typecheckCommand: (runId) => typecheckCommand(plan.harnessRoot, runId),
        now: options.now,
        dryRun: options.dryRun,
        ...(options.log !== undefined ? { log: options.log } : {}),
        ...(plan.acceptance?.enabled === true ? { acceptance: acceptanceRunner(plan.acceptance) } : {}),
      },
      spec,
    );
    if (!r.success) return DomainResult.fail(r.errors);
    results.push(r.data);
  }
  return DomainResult.ok(results);
}

/** The final console summary: runs, the planned call budget and the turns this invocation ran. */
export function gridSummary(loaded: LoadedPlan, results: readonly LoopRunResult[], dryRun: boolean): Record<string, unknown> {
  const completed = results.filter((r) => r.kind === 'completed');
  let stepTurns = 0;
  let repairTurns = 0;
  let repairsCleared = 0;
  for (const r of completed) {
    for (const s of r.steps.slice(r.resumedFromStep)) {
      for (const t of s.turns) {
        if (t.kind === 'step') stepTurns++;
        else repairTurns++;
      }
      if (s.repair?.cleared === true) repairsCleared++;
    }
  }
  return {
    outRoot: loaded.plan.outRoot,
    dryRun,
    runs: results.length,
    completed: completed.length,
    skipped: results.length - completed.length,
    callBudget: planCallBudget(loaded.plan, loaded.tasks.tasks),
    turnsThisInvocation: { step: stepTurns, repair: repairTurns, repairsCleared },
    // R01: gate steps the gate could not judge (no evaluation); non-zero means the gate arm did not run as designed.
    gateStepsWithoutEvaluation: gateEvaluationFailures(results),
  };
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
  const loaded = loadLoopPlan(planFile, repoRoot, args.data.local, { requireSpecSha256: deps.parentEnv[SPEC_SHA_ENV] === '1' });
  if (!loaded.success) return report(deps, loaded.errors);
  if (!path.isAbsolute(loaded.data.plan.outRoot)) return report(deps, [{ code: 'LOOP_PLAN_INVALID', message: 'outRoot must be absolute' }]);
  let wiring: Wiring;
  if (args.data.dryRun) {
    const dry = dryRunWiring(loaded.data, repoRoot);
    if (!dry.success) return report(deps, dry.errors);
    wiring = dry.data;
  } else {
    const live = await liveWiring(loaded.data, repoRoot, args.data, deps);
    if (!live.success) {
      const unavailable = live.errors.some((e) => e.code === 'LOOP_CLI_UNAVAILABLE' || e.code === 'LOOP_CLI_VERSION_MISMATCH');
      report(deps, live.errors);
      return unavailable ? 1 : 2;
    }
    wiring = live.data;
  }
  // The evaluator engine of a live grid (a dry run evaluates with stubs, so it has none).
  const engine = args.data.dryRun ? undefined : liveEngine(args.data.engine, loaded.data.plan.engine);
  const grid = await runLoopGrid(loaded.data, wiring, {
    dryRun: args.data.dryRun,
    now: deps.now,
    planSha256: sha256File(planFile),
    tasksSha256: sha256File(loaded.data.tasksPath),
    log: (line) => {
      deps.out(`${line}\n`);
    },
    ...(engine !== undefined ? { engine } : {}),
  });
  if (!grid.success) return report(deps, grid.errors);
  deps.out(`${JSON.stringify(gridSummary(loaded.data, grid.data, args.data.dryRun), null, 2)}\n`);
  return 0;
}
