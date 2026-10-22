/**
 * HEXDDD-01 exploratory pilot driver (NOT Study 2b; design `ops/notes/hexddd-01-violation-elicitation-design.md` §5).
 *
 * It reuses the loop harness (`scripts/lib/loop/`, frozen, unchanged) and adds only what the design lists as missing
 * (§8 items 1 and 2), outside the frozen paths:
 * - **Seed start.** Each run's work tree is the skeleton (`prepareCellDir`) plus the task's committed seed tree
 *   (`seeds/`, its tree sha256 checked against the plan), so the loop's base commit IS the seed and step 1 is the first
 *   change request on it.
 * - **Brownfield frame.** `BrownfieldFrameAgent` wraps the harness's `ClaudeStepAgent` and sends `FRAME` (an existing
 *   TypeScript service, the request, keep the type-check passing; no style, layer or folder) instead of the harness's
 *   step frame. The harness frame's sha256 and the sent prompt's sha256 are written per turn
 *   (`turns/step-NN/frame-<turnId>.json`), and `prompt-<turnId>.txt` is overwritten with the text actually sent. The
 *   step records' `promptSha256` still hashes the harness frame (the loop computes it); `frame-<turnId>.json` is the
 *   record of what was sent.
 * - **Call ledger.** Every spawn of the Claude binary that is not `--version` goes through `LedgerRunner`, which appends
 *   one line to `<outRoot>/calls.jsonl` and refuses a spawn beyond the plan's `hardCap` (per phase, per pilot run, and in
 *   total). The harness's own retries are therefore capped too.
 *
 * Modes (repository root; `--out-root` and `--harness-root` absolute, outside the repository):
 *   npx tsx experiments/pilot-hexddd-01/run-pilot.ts --frames --harness-root <H>              (zero calls)
 *   npx tsx experiments/pilot-hexddd-01/run-pilot.ts --seed-eval --out-root <O> --harness-root <H>   (zero calls)
 *   npx tsx experiments/pilot-hexddd-01/run-pilot.ts --smoke  --out-root <O> --harness-root <H> --binary <claude>   (1 call)
 *   npx tsx experiments/pilot-hexddd-01/run-pilot.ts --probes --out-root <O> --harness-root <H> --binary <claude>   (5 calls)
 *   npx tsx experiments/pilot-hexddd-01/run-pilot.ts --pilot  --out-root <O> --harness-root <H> --binary <claude>   (10, cap 12)
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { buildContext } from '../../src/mcp-server/context.js';
import { runConfinementProbes } from '../../scripts/generator/probes/confinement.js';
import { armPrompt } from '../../scripts/lib/generators/arms.js';
import { typecheckCommand } from '../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../scripts/lib/generators/config.js';
import { buildHarnessTsconfig } from '../../scripts/lib/generators/harness-tsconfig.js';
import { realSleep, systemClock } from '../../scripts/lib/generators/retry.js';
import { checkSkeletonIntact, ensureHarness, prepareCellDir } from '../../scripts/lib/generators/skeleton.js';
import { ClaudeStepAgent } from '../../scripts/lib/loop/agents.js';
import { evaluatorForEngine } from '../../scripts/lib/loop/engine-tee.js';
import { harnessTypechecker, loopEvaluatorOf } from '../../scripts/lib/loop/evaluator.js';
import { buildProfiles, runLoopGrid } from '../../scripts/lib/loop/main.js';
import { loadLoopPlan, loopRunId, planCallBudget } from '../../scripts/lib/loop/plan.js';
import type { LoadedPlan } from '../../scripts/lib/loop/plan.js';
import { iseDddFreezer } from '../../scripts/lib/loop/specs.js';
import type { LoopTask, StepAgent, StepEvaluator, TurnInput, TurnResult } from '../../scripts/lib/loop/types.js';

const REPO = process.cwd();
const HERE = 'experiments/pilot-hexddd-01';
const PLAN = `${HERE}/plan.json`;

/** The brownfield frame (design §5.1): no style, no layer, no folder. Slots: `{{REQUEST}}`, `{{TYPECHECK_COMMAND}}`. */
export const FRAME = [
  'The current directory holds an existing TypeScript service.',
  '',
  'Change request:',
  '{{REQUEST}}',
  '',
  'Keep every existing feature working. Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

/** The smoke check's trivial turn (no file is asked for). */
export const SMOKE_PROMPT = 'Reply with the single word ready. Do not read, write or run anything.';

const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

export function framePrompt(request: string, tcCommand: string): string {
  return FRAME.replace('{{REQUEST}}', request.trim()).replace('{{TYPECHECK_COMMAND}}', tcCommand);
}

interface HardCap {
  readonly smoke: number;
  readonly probes: number;
  readonly pilot: number;
  readonly pilotPerRun: number;
  readonly total: number;
}
type Phase = 'smoke' | 'probes' | 'pilot';

interface PilotPlanExtras {
  readonly hardCap: HardCap;
  readonly seeds: Readonly<Record<string, { readonly dir: string; readonly treeSha256: string }>>;
}

/** Counts and caps every generator spawn (module header). */
export class LedgerRunner implements ProcessRunner {
  constructor(
    private readonly inner: ProcessRunner,
    private readonly binary: string,
    private readonly ledger: string,
    private readonly phase: Phase,
    private readonly cap: HardCap,
  ) {}

  private lines(): { phase: Phase; run: string | null }[] {
    if (!fs.existsSync(this.ledger)) return [];
    return fs
      .readFileSync(this.ledger, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as { phase: Phase; run: string | null });
  }

  /** Number of generator calls recorded so far, per phase and in total. */
  counts(): Record<Phase | 'total', number> {
    const out = { smoke: 0, probes: 0, pilot: 0, total: 0 };
    for (const l of this.lines()) {
      out[l.phase]++;
      out.total++;
    }
    return out;
  }

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    const isCall = command === this.binary && !args.includes('--version');
    if (!isCall) return this.inner.run(command, args, options);
    const run = options.cwd !== undefined ? runOfCwd(options.cwd) : null;
    const lines = this.lines();
    const inPhase = lines.filter((l) => l.phase === this.phase).length;
    const inRun = lines.filter((l) => l.phase === this.phase && l.run === run).length;
    const refusal =
      lines.length >= this.cap.total
        ? `total cap ${String(this.cap.total)} reached`
        : inPhase >= this.cap[this.phase]
          ? `${this.phase} cap ${String(this.cap[this.phase])} reached`
          : this.phase === 'pilot' && inRun >= this.cap.pilotPerRun
            ? `per-run cap ${String(this.cap.pilotPerRun)} reached for ${String(run)}`
            : null;
    if (refusal !== null) return DomainResult.fail([{ code: 'PILOT_HARD_CAP', message: refusal }]);
    const at = new Date().toISOString();
    const r = await this.inner.run(command, args, options);
    const line = {
      phase: this.phase,
      run,
      at,
      finishedAt: new Date().toISOString(),
      exitCode: r.success ? r.data.exitCode : null,
      timedOut: r.success ? r.data.timedOut : null,
      spawnFailed: !r.success,
    };
    fs.mkdirSync(path.dirname(this.ledger), { recursive: true });
    fs.appendFileSync(this.ledger, `${JSON.stringify(line)}\n`);
    return r;
  }
}

/** `<O>/runs/<adapter>/<model>/<task>/<arm>/run-<r>/work` → `<adapter>/<model>/<task>/<arm>/run-<r>`; null otherwise. */
function runOfCwd(cwd: string): string | null {
  const m = /\/runs\/([^/]+\/[^/]+\/[^/]+\/[^/]+\/run-\d+)\/work(?:\/|$)/.exec(cwd.replace(/\\/g, '/'));
  return m?.[1] ?? null;
}

/** Wraps the harness agent: sends the brownfield frame instead of the harness frame (module header). */
export class BrownfieldFrameAgent implements StepAgent {
  readonly adapterId: StepAgent['adapterId'];
  readonly modelId: string;

  constructor(
    private readonly inner: StepAgent,
    private readonly tasks: ReadonlyMap<string, LoopTask>,
    private readonly harnessRoot: string,
  ) {
    this.adapterId = inner.adapterId;
    this.modelId = inner.modelId;
  }

  async runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    if (input.kind !== 'step') return DomainResult.fail([{ code: 'PILOT_NO_REPAIR', message: 'the pilot has no repair turn (arm none)' }]);
    const request = this.tasks.get(input.taskId)?.steps[input.stepIndex]?.request;
    if (request === undefined) return DomainResult.fail([{ code: 'PILOT_STEP_UNKNOWN', message: `${input.taskId} step ${String(input.stepIndex + 1)}` }]);
    const prompt = framePrompt(request, typecheckCommand(this.harnessRoot, input.runId));
    fs.writeFileSync(path.join(input.recordDir, `prompt-${input.turnId}.txt`), prompt);
    const record = { schema: 'hexddd-01-frame/v1', turnId: input.turnId, harnessFrameSha256: sha256(input.prompt), sentPromptSha256: sha256(prompt), frameTemplateSha256: sha256(FRAME) };
    fs.writeFileSync(path.join(input.recordDir, `frame-${input.turnId}.json`), `${JSON.stringify(record, null, 2)}\n`);
    return this.inner.runTurn({ ...input, prompt });
  }
}

function copySeed(seedDir: string, cwd: string): void {
  for (const e of fs.readdirSync(seedDir, { withFileTypes: true })) {
    const from = path.join(seedDir, e.name);
    const to = path.join(cwd, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copySeed(from, to);
    } else fs.copyFileSync(from, to);
  }
}

function treeSha(dir: string): string {
  const files: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else files.push(r);
    }
  };
  walk('');
  const lines = files.sort().map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`);
  return sha256(`${lines.join('\n')}\n`);
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function load(argv: readonly string[]): { loaded: LoadedPlan; extras: PilotPlanExtras } {
  const harnessRoot = arg(argv, 'harness-root');
  const local = {
    outRoot: arg(argv, 'out-root') ?? '/nonexistent-out-root',
    ...(harnessRoot !== undefined ? { harnessRoot } : {}),
    binary: arg(argv, 'binary') ?? '/nonexistent-binary',
  };
  const r = loadLoopPlan(path.resolve(REPO, PLAN), REPO, local);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const extras = JSON.parse(fs.readFileSync(path.resolve(REPO, PLAN), 'utf8')) as PilotPlanExtras;
  for (const [task, s] of Object.entries(extras.seeds)) {
    const got = treeSha(path.resolve(REPO, s.dir));
    if (got !== s.treeSha256) throw new Error(`seed of ${task}: tree sha256 ${got}, the plan pins ${s.treeSha256}`);
  }
  return { loaded: r.data, extras };
}

/** `--frames`: the exact prompts each step would send (`armPrompt` of arm none included), for the hint audit. */
function writeFrames(loaded: LoadedPlan, harnessRoot: string): void {
  const dir = path.join(REPO, HERE, 'hint-audit');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'frame-template.txt'), FRAME);
  for (const t of loaded.tasks.tasks) {
    const runId = loopRunId({ adapterId: 'claude-code-cli', modelId: loaded.plan.adapters[0]?.modelId ?? '', taskId: t.id, arm: 'none', runIndex: 0 });
    const texts = t.steps.map((s, i) => `=== ${t.id} step ${String(i + 1)} (${s.id})\n${armPrompt(framePrompt(s.request, typecheckCommand(harnessRoot, runId)), 'none')}`);
    fs.writeFileSync(path.join(dir, `prompts-${t.id}.txt`), `${texts.join('\n')}\n`);
  }
  process.stdout.write(`frames written to ${HERE}/hint-audit/ (harness root shown as given)\n`);
}

async function evaluatorFactory(plan: LoadedPlan['plan']): Promise<(specFile: string) => StepEvaluator> {
  const evaluateDeps = buildContext({}, process.env).evaluateDeps;
  return (specFile) => evaluatorForEngine('cypher-interp', evaluateDeps, process.env, (d, env) => loopEvaluatorOf(plan.harnessRoot, env, d)(specFile));
}

/** `--seed-eval` (zero calls): the seed trees evaluated exactly as a loop snapshot is (step 0 of D_seed). */
async function seedEval(loaded: LoadedPlan, extras: PilotPlanExtras): Promise<number> {
  const { plan } = loaded;
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, plan.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  const evaluatorOf = await evaluatorFactory(plan);
  const typecheck = harnessTypechecker(new NodeProcessRunner(), plan.harnessRoot);
  const out: Record<string, unknown> = {};
  for (const t of loaded.tasks.tasks) {
    const runId = `seed-eval/${t.id}`;
    const cwd = path.join(plan.outRoot, 'seed-eval', t.id, 'work');
    fs.rmSync(path.dirname(cwd), { recursive: true, force: true });
    const prep = prepareCellDir(ready.data.install, REPO, cwd);
    if (!prep.success) throw new Error(prep.errors.map((e) => e.message).join('\n'));
    copySeed(path.resolve(REPO, extras.seeds[t.id]?.dir ?? ''), cwd);
    const spec = plan.taskProfiles?.[t.id]?.evaluatorSpec ?? '';
    const tc = await typecheck.typecheck(runId, cwd);
    const ev = await evaluatorOf(path.resolve(REPO, spec)).evaluate(cwd, runId);
    out[t.id] = {
      typecheck: tc.success ? tc.data : { error: tc.errors },
      evaluation: ev.success ? { ...ev.data, reportViolations: undefined } : { error: ev.errors },
      reportViolations: ev.success ? ev.data.reportViolations : null,
    };
  }
  const file = path.join(plan.outRoot, 'seed-eval', 'seed-eval.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  process.stdout.write(`${file}\n`);
  return 0;
}

function claudeAgent(loaded: LoadedPlan, runner: ProcessRunner): ClaudeStepAgent {
  const { plan } = loaded;
  const a = plan.adapters[0];
  if (a === undefined) throw new Error('no adapter');
  const c = createGeneratorCliConfig(
    { binary: plan.binary, modelId: a.modelId, outputRoot: plan.outRoot, harnessRoot: plan.harnessRoot, allowBash: plan.allowBash, ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}) },
    REPO,
  );
  if (!c.success) throw new Error(c.errors.map((e) => e.message).join('\n'));
  return new ClaudeStepAgent(c.data, { runner, parentEnv: process.env, clock: systemClock, sleep: realSleep, ...(a.cliVersion !== undefined ? { cliVersion: a.cliVersion } : {}) });
}

/** `--smoke` (1 call): one trivial turn through the harness's Claude step agent, in a scratch cell with the skeleton. */
async function smoke(loaded: LoadedPlan, extras: PilotPlanExtras): Promise<number> {
  const { plan } = loaded;
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, plan.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  const runner = new LedgerRunner(new NodeProcessRunner(), plan.binary, path.join(plan.outRoot, 'calls.jsonl'), 'smoke', extras.hardCap);
  const agent = claudeAgent(loaded, runner);
  const probed = await agent.probe();
  const runId = 'smoke/claude-sonnet-5-5/smoke/none/run-0';
  const cwd = path.join(plan.outRoot, 'smoke', 'work');
  const recordDir = path.join(plan.outRoot, 'smoke', 'turn');
  fs.rmSync(path.join(plan.outRoot, 'smoke'), { recursive: true, force: true });
  const prep = prepareCellDir(ready.data.install, REPO, cwd);
  if (!prep.success) throw new Error(prep.errors.map((e) => e.message).join('\n'));
  fs.mkdirSync(recordDir, { recursive: true });
  const r = await agent.runTurn({
    runId, turnId: 'smoke', taskId: 'smoke', kind: 'step', stepIndex: 0, arm: 'none', cwd, prompt: SMOKE_PROMPT, recordDir,
    changedFiles: () => 0, restore: () => DomainResult.ok(undefined), archive: () => DomainResult.ok('none'),
  });
  const envelopeFile = path.join(recordDir, 'envelope-smoke.json');
  const envelope = fs.existsSync(envelopeFile) ? (JSON.parse(fs.readFileSync(envelopeFile, 'utf8')) as Record<string, unknown>) : null;
  const result = {
    schema: 'hexddd-01-smoke/v1',
    cliVersion: probed.success ? probed.data.cliVersion : null,
    probe: probed.success ? 'ok' : probed.errors,
    turn: r.success ? { status: r.data.status, attempts: r.data.attempts, usage: r.data.usage } : { errors: r.errors },
    envelope: envelope === null ? null : { isError: envelope.is_error ?? null, subtype: envelope.subtype ?? null, result: typeof envelope.result === 'string' ? envelope.result.slice(0, 400) : envelope.result ?? null, unreadable: envelope.unreadable ?? null, exitCode: envelope.exitCode ?? null },
    calls: runner.counts(),
    passed: r.success && r.data.status === 'completed',
  };
  fs.writeFileSync(path.join(plan.outRoot, 'smoke', 'smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.passed ? 0 : 1;
}

/** `--probes` (5 calls): the no-MCP confinement probes 1–5 of `scripts/generator/probes/confinement.ts`, unchanged. */
async function probes(loaded: LoadedPlan, extras: PilotPlanExtras): Promise<number> {
  const { plan } = loaded;
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, plan.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  const runner = new LedgerRunner(new NodeProcessRunner(), plan.binary, path.join(plan.outRoot, 'calls.jsonl'), 'probes', extras.hardCap);
  const cfg = createGeneratorCliConfig(
    { binary: plan.binary, modelId: plan.adapters[0]?.modelId ?? '', outputRoot: path.join(plan.outRoot, 'probes'), harnessRoot: plan.harnessRoot, allowBash: true, ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}) },
    REPO,
  );
  if (!cfg.success) throw new Error(cfg.errors.map((e) => e.message).join('\n'));
  const r = await runConfinementProbes({ runner, repoRoot: REPO, config: cfg.data, install: ready.data.install, parentEnv: process.env, clock: systemClock });
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  process.stdout.write(`${JSON.stringify({ ...r.data, calls: runner.counts() }, null, 2)}\n`);
  return r.data.allPassed ? 0 : 1;
}

/** `--pilot` (10 calls, cap 12): the loop grid with the seed start and the brownfield frame. */
async function pilot(loaded: LoadedPlan, extras: PilotPlanExtras): Promise<number> {
  const { plan } = loaded;
  const budget = planCallBudget(plan, loaded.tasks.tasks);
  if (budget.maxCalls > extras.hardCap.pilot) throw new Error('the plan budget exceeds the hard cap');
  const ready = await ensureHarness(new NodeProcessRunner(), REPO, plan.harnessRoot);
  if (!ready.success) throw new Error(ready.errors.map((e) => e.message).join('\n'));
  const install = ready.data.install;
  const runner = new LedgerRunner(new NodeProcessRunner(), plan.binary, path.join(plan.outRoot, 'calls.jsonl'), 'pilot', extras.hardCap);
  const inner = claudeAgent(loaded, runner);
  const probed = await inner.probe();
  if (!probed.success) throw new Error(probed.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  const tasks = new Map(loaded.tasks.tasks.map((t) => [t.id, t]));
  const agent = new BrownfieldFrameAgent(inner, tasks, plan.harnessRoot);
  const evaluatorOf = await evaluatorFactory(plan);
  const profiles = buildProfiles(loaded, REPO, evaluatorOf, iseDddFreezer(REPO));
  if (!profiles.success) throw new Error(profiles.errors.map((e) => e.message).join('\n'));
  const wiring = {
    agents: new Map<string, StepAgent>([[`${agent.adapterId}/${agent.modelId}`, agent]]),
    evaluator: { id: 'no-default', evaluate: () => Promise.resolve(DomainResult.fail<never>([{ code: 'PILOT_NO_DEFAULT_SPEC', message: 'every task has a profile' }])) },
    ...(profiles.data !== undefined ? { profiles: profiles.data } : {}),
    typechecker: harnessTypechecker(new NodeProcessRunner(), plan.harnessRoot),
    prepareWorkDir: (cwd: string): DomainResult<void> => {
      const run = runOfCwd(cwd);
      const taskId = run?.split('/')[2];
      const seed = taskId !== undefined ? extras.seeds[taskId] : undefined;
      if (seed === undefined) return DomainResult.fail([{ code: 'PILOT_SEED_UNKNOWN', message: `no seed for ${cwd}` }]);
      const prep = prepareCellDir(install, REPO, cwd);
      if (!prep.success) return prep;
      copySeed(path.resolve(REPO, seed.dir), cwd);
      return DomainResult.ok(undefined);
    },
    skeletonIntact: (cwd: string): boolean => checkSkeletonIntact(install, REPO, cwd).skeletonIntact,
  };
  const grid = await runLoopGrid(loaded, wiring, {
    dryRun: false,
    now: () => new Date(),
    planSha256: sha256(fs.readFileSync(path.resolve(REPO, PLAN))),
    tasksSha256: sha256(fs.readFileSync(loaded.tasksPath)),
    log: (line) => process.stdout.write(`${line}\n`),
    engine: 'cypher-interp',
  });
  const counts = runner.counts();
  process.stdout.write(`${JSON.stringify({ cliVersion: probed.data.cliVersion, budget, calls: counts }, null, 2)}\n`);
  if (!grid.success) {
    process.stderr.write(`${grid.errors.map((e) => `${e.code}: ${e.message}`).join('\n')}\n`);
    return 1;
  }
  return 0;
}

/** Writes the harness tsconfig of a tree (used by the scorer). */
export function treeTsconfig(tree: string): string {
  const file = `${tree}.tsconfig.json`;
  fs.writeFileSync(file, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return file;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes('--frames')) {
    const { loaded } = load(argv);
    writeFrames(loaded, loaded.plan.harnessRoot);
    return 0;
  }
  const { loaded, extras } = load(argv);
  if (!path.isAbsolute(loaded.plan.outRoot) || !path.isAbsolute(loaded.plan.harnessRoot)) throw new Error('--out-root and --harness-root must be absolute');
  if (argv.includes('--seed-eval')) return seedEval(loaded, extras);
  if (argv.includes('--smoke')) return smoke(loaded, extras);
  if (argv.includes('--probes')) return probes(loaded, extras);
  if (argv.includes('--pilot')) return pilot(loaded, extras);
  process.stderr.write('usage: run-pilot.ts --frames | --seed-eval | --smoke | --probes | --pilot (see the module header)\n');
  return 2;
}

void main(process.argv.slice(2)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
