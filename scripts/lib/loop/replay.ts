/**
 * Loop replay: the whole firewall-in-the-loop harness, end to end, with a deterministic scripted agent in place of
 * the model (no LLM call anywhere). It exists so the real pilot (`Docs/v1.3/pilot-outcome-memo.md`) cannot fail on
 * plumbing. Report: `Docs/v1.3/loop-replay.md`.
 *
 * What runs for real: the pilot plan's tasks file and task profiles (style frames, `specs/clean-arch.yaml`,
 * `presets/hexagonal.yaml`, the DDD spec inferred by the ISE from step 1 and frozen), `runLoop` (work directories,
 * snapshot store, measures, the gate's repair turn, `repairOutcome`), the v1.3 firewall evaluator (`evaluate_project`
 * on Neo4j), and the MCP tool handlers `check_file` and `check_diff` (`src/mcp-server/tools.ts`, called in process).
 * What is replaced: the generator (a `ScriptedStepAgent` replaying `replay-tapes.ts`) and the E1 type-check of
 * record (`inProcessTypechecker`: the same compiler options through the TypeScript API, so no skeleton install).
 *
 * The scripted agent, per arm:
 * - `none`: applies the step's edits; nothing else.
 * - `daedalus-mcp`: applies the step's edits, then calls `check_diff` on the turn's diff and `check_file` on every
 *   written file. If a tool reports violations and the tape has a scripted fix for the step, it applies the fix and
 *   calls `check_file` again on the fixed files. Feedback without a scripted fix is recorded as unfollowed.
 * - `gate`: step turns apply the step's edits; a repair turn (the harness runs one only on blocking findings) applies
 *   the step's scripted fix.
 * Each turn writes `envelope-<turnId>.json` (edits and tool calls; deterministic) and `timing-<turnId>.json`
 * (turn and tool latency; the only file that differs between two replays besides the timing fields of the records).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { checkDiffTool, checkFileTool, createSpecLoader } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import { writeHarnessTsconfig } from '../generators/harness-tsconfig.js';
import { CLAUDE_CODE_ADAPTER_ID } from '../generators/types.js';
import { firewallEvaluator, harnessSnapshotTsconfig } from './evaluator.js';
import { runDirFor, runLoop, stepRecordPath } from './loop.js';
import type { LoopContext, LoopRunResult, TaskProfile } from './loop.js';
import { buildProfiles, prepareDryRunWorkDir } from './main.js';
import { loadLoopPlan, loopRunId } from './plan.js';
import type { LoadedPlan } from './plan.js';
import { FROZEN_SPEC_FILE, SPEC_DIR, iseDddFreezer } from './specs.js';
import type {
  LoopArm,
  LoopRunSpec,
  StepAgent,
  StepEvaluation,
  StepEvaluator,
  StepRecord,
  StepTypechecker,
  TurnInput,
  TurnResult,
} from './types.js';

export const REPLAY_MODEL_ID = 'scripted-replay';
export const REPLAY_PLAN = 'experiments/loop-pilot/plan.json';
/** Every replay commit and record carries this date and time (no clock in the deterministic outputs). */
export const REPLAY_EPOCH = '2026-10-16T00:00:00Z';
export const REPLAY_ARMS: readonly LoopArm[] = Object.freeze(['none', 'daedalus-mcp', 'gate']);

/** Whole-file writes, POSIX paths relative to the work directory; `null` deletes. */
export type FileEdits = Readonly<Record<string, string | null>>;

export interface ReplayStep {
  readonly edits: FileEdits;
  /** Set on a step scripted to introduce one blocking violation: why, and the edits that fix it. */
  readonly violating?: { readonly why: string; readonly fix: FileEdits };
}

export interface ReplayTape {
  readonly taskId: string;
  readonly steps: readonly ReplayStep[];
}

/** One MCP tool call of a `daedalus-mcp` turn, as the envelope records it. */
export interface ToolCallRecord {
  readonly tool: 'check_diff' | 'check_file';
  readonly phase: 'after-step' | 'after-fix';
  /** `check_file`: the file; `check_diff`: the files of the diff. */
  readonly paths: readonly string[];
  readonly ok: boolean;
  readonly verdict: string | null;
  readonly violations: readonly { readonly path: string; readonly rule: string; readonly ruleName: string; readonly line: number; readonly subject: string }[];
  /** The failure message when `ok` is false (for example: no spec yet). */
  readonly message?: string;
}

export interface ReplayEnvelope {
  readonly scripted: true;
  readonly turnId: string;
  readonly arm: LoopArm;
  readonly written: readonly string[];
  readonly deleted: readonly string[];
  readonly toolCalls: readonly ToolCallRecord[];
  /** `daedalus-mcp`: whether the tools reported violations, and whether the scripted fix was applied for them. */
  readonly feedback: { readonly reported: boolean; readonly fixApplied: boolean; readonly unfollowed: boolean } | null;
}

export interface ReplayTiming {
  readonly turnMs: number;
  readonly toolCalls: readonly { readonly tool: string; readonly phase: string; readonly ms: number }[];
}

function sortedObject<T>(o: Readonly<Record<string, T>>): [string, T][] {
  return Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function readOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function linesOf(text: string): string[] {
  const l = text.split('\n');
  if (l[l.length - 1] === '') l.pop();
  return l;
}

/** A unified diff of whole-file replacements (`check_diff` input): every new line is an added line. */
export function wholeFileDiff(changes: readonly { readonly path: string; readonly before: string | null; readonly after: string | null }[]): string {
  const out: string[] = [];
  for (const c of changes) {
    const a = c.before === null ? [] : linesOf(c.before);
    const b = c.after === null ? [] : linesOf(c.after);
    out.push(`diff --git a/${c.path} b/${c.path}`);
    out.push(c.before === null ? '--- /dev/null' : `--- a/${c.path}`);
    out.push(c.after === null ? '+++ /dev/null' : `+++ b/${c.path}`);
    out.push(`@@ -${a.length === 0 ? '0,0' : `1,${String(a.length)}`} +${b.length === 0 ? '0,0' : `1,${String(b.length)}`} @@`);
    for (const l of a) out.push(`-${l}`);
    for (const l of b) out.push(`+${l}`);
  }
  return `${out.join('\n')}\n`;
}

/** Where the `daedalus-mcp` tools of a run find their spec: a static file, or the run's frozen spec once it exists. */
export type ToolSpecOf = (runId: string, taskId: string) => string | null;

/** The deterministic stand-in for the generator. */
export class ScriptedStepAgent implements StepAgent {
  readonly adapterId = CLAUDE_CODE_ADAPTER_ID;
  readonly modelId = REPLAY_MODEL_ID;
  private readonly tapes: ReadonlyMap<string, ReplayTape>;
  private readonly loadSpec = createSpecLoader();

  constructor(
    tapes: readonly ReplayTape[],
    private readonly toolSpecOf: ToolSpecOf,
    private readonly evaluateDeps: EvaluateDeps,
  ) {
    this.tapes = new Map(tapes.map((t) => [t.taskId, t]));
  }

  private apply(cwd: string, edits: FileEdits, written: Set<string>, deleted: Set<string>): { path: string; before: string | null; after: string | null }[] {
    const changes: { path: string; before: string | null; after: string | null }[] = [];
    for (const [rel, text] of sortedObject(edits)) {
      const abs = path.join(cwd, ...rel.split('/'));
      const before = readOrNull(abs);
      if (text === null) {
        fs.rmSync(abs, { force: true });
        deleted.add(rel);
        written.delete(rel);
      } else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
        written.add(rel);
        deleted.delete(rel);
      }
      if (before !== text) changes.push({ path: rel, before, after: text });
    }
    return changes;
  }

  private async callTools(
    input: TurnInput,
    phase: ToolCallRecord['phase'],
    changes: readonly { path: string; before: string | null; after: string | null }[],
    calls: ToolCallRecord[],
    timings: ReplayTiming['toolCalls'][number][],
  ): Promise<boolean> {
    const specPath = this.toolSpecOf(input.runId, input.taskId);
    const ctx: ServerContext = { defaultSpecPath: specPath ?? undefined, defaultProjectPath: input.cwd, env: {}, evaluateDeps: this.evaluateDeps, loadSpec: this.loadSpec };
    let reported = false;
    const record = (tool: ToolCallRecord['tool'], paths: readonly string[], ms: number, r: Awaited<ReturnType<typeof checkFileTool>> | Awaited<ReturnType<typeof checkDiffTool>>): void => {
      timings.push({ tool, phase, ms });
      if (!r.ok) {
        calls.push({ tool, phase, paths, ok: false, verdict: null, violations: [], message: r.message });
        return;
      }
      const files = 'files' in r.data ? r.data.files : [r.data];
      const violations = files.flatMap((f) => f.violations.map((v) => ({ path: f.path, rule: v.rule, ruleName: v.ruleName, line: v.line, subject: v.subject })));
      if (violations.length > 0) reported = true;
      calls.push({ tool, phase, paths, ok: true, verdict: r.data.verdict, violations });
    };
    if (specPath === null) {
      calls.push({ tool: 'check_diff', phase, paths: changes.map((c) => c.path), ok: false, verdict: null, violations: [], message: 'no spec for this run yet (the DDD spec is frozen after step 1)' });
      return false;
    }
    const sources = changes.filter((c) => c.after !== null && c.path.endsWith('.ts'));
    if (phase === 'after-step' && changes.length > 0) {
      const t0 = performance.now();
      const r = await checkDiffTool(ctx, { diff: wholeFileDiff(changes) });
      record('check_diff', changes.map((c) => c.path), performance.now() - t0, r);
    }
    for (const c of sources) {
      const t0 = performance.now();
      const r = await checkFileTool(ctx, { path: c.path, content: c.after ?? '' });
      record('check_file', [c.path], performance.now() - t0, r);
    }
    return reported;
  }

  async runTurn(input: TurnInput): Promise<DomainResult<TurnResult>> {
    const t0 = performance.now();
    const tape = this.tapes.get(input.taskId);
    const step = tape?.steps[input.stepIndex];
    if (step === undefined) return DomainResult.fail([{ code: 'LOOP_REPLAY_TAPE', message: `no tape step ${String(input.stepIndex + 1)} for ${input.taskId}` }]);
    const written = new Set<string>();
    const deleted = new Set<string>();
    const calls: ToolCallRecord[] = [];
    const timings: ReplayTiming['toolCalls'][number][] = [];
    let feedback: ReplayEnvelope['feedback'] = null;
    if (input.kind === 'repair') {
      this.apply(input.cwd, step.violating?.fix ?? {}, written, deleted);
    } else {
      const changes = this.apply(input.cwd, step.edits, written, deleted);
      if (input.arm === 'daedalus-mcp') {
        const reported = await this.callTools(input, 'after-step', changes, calls, timings);
        const fix = step.violating?.fix;
        if (reported && fix !== undefined) {
          const fixed = this.apply(input.cwd, fix, written, deleted);
          await this.callTools(input, 'after-fix', fixed, calls, timings);
        }
        feedback = { reported, fixApplied: reported && fix !== undefined, unfollowed: reported && fix === undefined };
      }
    }
    const envelope: ReplayEnvelope = { scripted: true, turnId: input.turnId, arm: input.arm, written: [...written].sort(), deleted: [...deleted].sort(), toolCalls: calls, feedback };
    fs.mkdirSync(input.recordDir, { recursive: true });
    const envelopePath = `envelope-${input.turnId}.json`;
    fs.writeFileSync(path.join(input.recordDir, envelopePath), `${JSON.stringify(envelope, null, 2)}\n`);
    const wallMs = Math.round(performance.now() - t0);
    const timing: ReplayTiming = { turnMs: wallMs, toolCalls: timings.map((t) => ({ ...t, ms: Math.round(t.ms * 1000) / 1000 })) };
    fs.writeFileSync(path.join(input.recordDir, `timing-${input.turnId}.json`), `${JSON.stringify(timing, null, 2)}\n`);
    return DomainResult.ok({
      status: 'completed',
      // No model: no tokens and no cost. Null, not zero, so nothing reads a replay as a free model turn.
      usage: { costUsd: null, inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheCreationTokens: null, numTurns: null, durationMs: null },
      wallMs,
      attempts: [{ startedAt: REPLAY_EPOCH, outcome: 'completed' }],
      interruptions: [],
      argv: ['scripted-replay', input.arm, input.turnId],
      envelopePath,
      permissionDenials: 0,
    });
  }
}

/**
 * The E1 type-check of record without the skeleton install: it writes the pinned per-run tsconfig exactly as
 * `harnessTypechecker` does (`<harnessRoot>/runs/<runId>/tsconfig.json`, which the evaluator then also uses) and
 * compiles it through the TypeScript API instead of `<H>/bin/tsc`.
 */
export function inProcessTypechecker(harnessRoot: string): StepTypechecker & { readonly timings: Map<string, number[]> } {
  const timings = new Map<string, number[]>();
  return {
    timings,
    typecheck: (runId, cwd) => {
      const t0 = performance.now();
      const file = writeHarnessTsconfig(harnessRoot, runId, cwd);
      const parsed = ts.parseJsonConfigFileContent(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown, ts.sys, path.dirname(file));
      const program = ts.createProgram(parsed.fileNames, parsed.options);
      const diags = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter((d) => d.category === ts.DiagnosticCategory.Error);
      const codes = diags.map((d) => `TS${String(d.code)}`);
      timings.set(runId, [...(timings.get(runId) ?? []), performance.now() - t0]);
      return Promise.resolve(DomainResult.ok({ errors: codes.length, codes: codes.slice(0, 50) }));
    },
  };
}

/** Materialises a snapshot commit of a run's store into a fresh directory (for the consistency re-evaluation). */
export function checkoutCommit(gitDir: string, commit: string, into: string): void {
  fs.mkdirSync(into, { recursive: true });
  const archive = spawnSync('git', [`--git-dir=${gitDir}`, 'archive', '--format=tar', commit], { maxBuffer: 256 * 1024 * 1024 });
  if (archive.status !== 0) throw new Error(`git archive ${commit} failed: ${archive.stderr.toString()}`);
  const tar = spawnSync('tar', ['-x', '-C', into], { input: archive.stdout });
  if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr.toString()}`);
}

/** A step evaluation without its timing field, for comparisons. */
export function evaluationContent(e: StepEvaluation | null | undefined): Omit<StepEvaluation, 'durationMs'> | null {
  if (e === null || e === undefined) return null;
  const { durationMs: _ignored, ...rest } = e;
  return rest;
}

export interface ReplayOptions {
  readonly repoRoot: string;
  /** Fresh directory outside the repository. */
  readonly outRoot: string;
  /** Where the pinned per-run tsconfigs go (outside `outRoot`: they hold absolute paths). */
  readonly harnessRoot: string;
  /** Neo4j settings and `APG_STORE_PATH` for the evaluator (never read from .env). */
  readonly evaluatorEnv: NodeJS.ProcessEnv;
  readonly evaluateDeps: EvaluateDeps;
  readonly tapes: readonly ReplayTape[];
  readonly arms?: readonly LoopArm[];
  readonly log?: (line: string) => void;
}

export interface ReplayRun {
  readonly runId: string;
  readonly spec: LoopRunSpec;
  readonly runDir: string;
  readonly result: LoopRunResult;
}

export interface ReplayResult {
  readonly loaded: LoadedPlan;
  readonly profiles: ReadonlyMap<string, TaskProfile>;
  readonly runs: readonly ReplayRun[];
  /** Type-check latency per run (ms, one entry per snapshot). */
  readonly typecheckMs: ReadonlyMap<string, readonly number[]>;
  /** Wall time of the loop's `evaluate_project` call per run (ms, one entry per snapshot). */
  readonly evaluateWallMs: ReadonlyMap<string, readonly number[]>;
  /** Evaluator of a spec file with an explicit tsconfig, for the consistency re-evaluation of a checkout. */
  readonly evaluatorOf: (specFile: string, tsconfigFile: string) => StepEvaluator;
}

/** Runs every tape under every arm, in tape then arm order, into `outRoot/runs/`. */
export async function runReplay(o: ReplayOptions): Promise<DomainResult<ReplayResult>> {
  const loaded = loadLoopPlan(path.join(o.repoRoot, REPLAY_PLAN), o.repoRoot, { outRoot: o.outRoot, binary: process.execPath, harnessRoot: o.harnessRoot });
  if (!loaded.success) return DomainResult.fail(loaded.errors);
  // The loop's evaluator, timed per call: `evaluation.durationMs` is the pipeline's own figure, not the wall time a
  // gate step waits (connection, extraction and ingestion included).
  const evaluateWallMs = new Map<string, number[]>();
  const evaluatorOf = (specFile: string): StepEvaluator => {
    const inner = firewallEvaluator(specFile, o.evaluatorEnv, o.evaluateDeps, harnessSnapshotTsconfig(o.harnessRoot));
    return {
      id: inner.id,
      evaluate: async (dir, runId) => {
        const t0 = performance.now();
        const r = await inner.evaluate(dir, runId);
        const key = runId ?? '';
        evaluateWallMs.set(key, [...(evaluateWallMs.get(key) ?? []), performance.now() - t0]);
        return r;
      },
    };
  };
  const built = buildProfiles(loaded.data, o.repoRoot, evaluatorOf, iseDddFreezer(o.repoRoot));
  if (!built.success) return DomainResult.fail(built.errors);
  const profiles = built.data ?? new Map<string, TaskProfile>();
  const tasks = new Map(loaded.data.tasks.tasks.map((t) => [t.id, t]));
  for (const tp of o.tapes) {
    const task = tasks.get(tp.taskId);
    if (task === undefined) return DomainResult.fail([{ code: 'LOOP_REPLAY_TAPE', message: `tape for unknown task ${tp.taskId}` }]);
    if (task.steps.length !== tp.steps.length) return DomainResult.fail([{ code: 'LOOP_REPLAY_TAPE', message: `${tp.taskId}: the tape has ${String(tp.steps.length)} steps, the task ${String(task.steps.length)}` }]);
  }
  const toolSpecOf: ToolSpecOf = (runId, taskId) => {
    const e = profiles.get(taskId)?.evaluation;
    if (e === undefined) return null;
    if (e.kind === 'static') return path.resolve(o.repoRoot, e.specPath);
    const frozen = path.join(runDirFor(o.outRoot, runId), SPEC_DIR, FROZEN_SPEC_FILE);
    return fs.existsSync(frozen) ? frozen : null;
  };
  const agent = new ScriptedStepAgent(o.tapes, toolSpecOf, o.evaluateDeps);
  const typechecker = inProcessTypechecker(o.harnessRoot);
  const nodeModules = path.join(o.repoRoot, 'node_modules');
  const fixed = new Date(REPLAY_EPOCH);
  const ctx: LoopContext = {
    outRoot: o.outRoot,
    tasks,
    agent,
    evaluator: { id: 'no-spec', evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LOOP_NO_SPEC', message: 'every replay task has a profile' }])) },
    profiles,
    typechecker,
    // The dry-run skeleton plus the `node_modules` symlink the E1 skeleton has (here: the repository's install).
    prepareWorkDir: (cwd) => {
      const r = prepareDryRunWorkDir(cwd);
      if (r.success) fs.symlinkSync(nodeModules, path.join(cwd, 'node_modules'), 'dir');
      return r;
    },
    skeletonIntact: () => true,
    typecheckCommand: () => 'tsc --noEmit (in-process, E1 options)',
    now: () => fixed,
    dryRun: false,
    snapshotDate: REPLAY_EPOCH,
    ...(o.log !== undefined ? { log: o.log } : {}),
  };
  const runs: ReplayRun[] = [];
  for (const tp of o.tapes) {
    for (const arm of o.arms ?? REPLAY_ARMS) {
      const spec: LoopRunSpec = { adapterId: CLAUDE_CODE_ADAPTER_ID, modelId: REPLAY_MODEL_ID, taskId: tp.taskId, arm, runIndex: 0 };
      const r = await runLoop(ctx, spec);
      if (!r.success) return DomainResult.fail(r.errors);
      const runId = loopRunId(spec);
      runs.push({ runId, spec, runDir: runDirFor(o.outRoot, runId), result: r.data });
    }
  }
  const checkoutEvaluatorOf = (specFile: string, tsconfigFile: string): StepEvaluator => firewallEvaluator(specFile, o.evaluatorEnv, o.evaluateDeps, () => tsconfigFile);
  return DomainResult.ok({ loaded: loaded.data, profiles, runs, typecheckMs: typechecker.timings, evaluateWallMs, evaluatorOf: checkoutEvaluatorOf });
}

/** The step records of a run, read back from disk. */
export function readRunSteps(runDir: string, steps: number): StepRecord[] {
  const out: StepRecord[] = [];
  for (let i = 0; i < steps; i++) out.push(JSON.parse(fs.readFileSync(stepRecordPath(runDir, i), 'utf8')) as StepRecord);
  return out;
}

/** A scratch directory for the APG store and consistency checkouts (outside the replay outRoot). */
export function scratchDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
