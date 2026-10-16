/**
 * The multi-step loop: k feature steps applied to one work directory, under one arm.
 *
 * Layout of a loop run (`<outRoot>/runs/<runId>/`):
 *   run.json             written when the run directory is created; `completedAt` set after the last step
 *   work/                the agent's cwd (skeleton `package.json` + read-only `node_modules` symlink, then the code)
 *   snapshots.git/       the snapshot store (outside `work/`; `snapshot.ts`)
 *   steps/step-NN.json   one record per finished step (written atomically, in step order)
 *   turns/step-NN/       scrubbed envelopes of the step's turns
 *   restarts.jsonl       one line per resume that discarded a partial step
 * Archived interrupted trees go to `<outRoot>/interruptions/<runId>/<turnId>/<n>/` (as the E1 grid does).
 *
 * Per step: the step turn runs (arm `none` / `daedalus-mcp` / `gate`), the tree is committed, measured (files, LOC,
 * diff, skeleton integrity), type-checked and evaluated. In the `gate` arm, when that evaluation reports blocking
 * findings, the agent gets them in one repair turn, and the tree is committed, measured, type-checked and evaluated
 * again; the step's outcome is the last snapshot. An evaluator failure is recorded on the snapshot (the commit is kept,
 * so it can be re-scored); a turn or snapshot failure is a harness failure and stops the run.
 *
 * Per-task style and spec (`LoopContext.profiles`, optional): the task's step frames carry its style slot (`style.ts`)
 * and its snapshots are evaluated against its own spec, a fixed file or a DDD spec the ISE infers from the run's
 * step-1 snapshot and freezes in `spec/` (`specs.ts`). Without a profile the task uses the default frame and
 * `LoopContext.evaluator`. Every turn's prompt is written beside its envelope (`turns/step-NN/prompt-<turnId>.txt`).
 * The gate's repair record says finding by finding which blocking findings the repair removed (`repairOutcome`).
 *
 * Resume: the step records are the only progress state. On start, a run with every step record and `completedAt` is
 * skipped; otherwise the work tree is put back to the last recorded step's final commit (the base commit when none),
 * any partial step after it is logged in `restarts.jsonl` and discarded, and the loop continues with the next step.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { agentFileCount, sourceFilePaths } from '../generators/outcome.js';
import { treeLoc } from '../so5-size.js';
import { loopRunId } from './plan.js';
import { MAX_REPAIR_FINDINGS, repairPrompt, sha256, stepPrompt } from './prompts.js';
import { WorkTreeSnapshots, SNAPSHOT_GIT_DIR } from './snapshot.js';
import { FROZEN_SPEC_FILE, FROZEN_SPEC_RECORD, ISE_RAW_FILE, SPEC_DIR } from './specs.js';
import type { FrozenSpecRecord, SpecFreezer } from './specs.js';
import type { LoopContextDecl, StyleFrame } from './style.js';
import type {
  BlockingFinding,
  LoopRunSpec,
  LoopTask,
  RunRecord,
  SnapshotMeasure,
  StepAgent,
  StepEvaluation,
  StepEvaluator,
  RepairOutcome,
  StepRecord,
  StepSpecRef,
  StepTypechecker,
  TurnKind,
  TurnRecord,
} from './types.js';

export const RUN_JSON = 'run.json';
export const WORK_DIR = 'work';
export const STEPS_DIR = 'steps';
export const TURNS_DIR = 'turns';
export const RESTARTS_LOG = 'restarts.jsonl';
export const LOOP_INTERRUPTIONS_DIR = 'interruptions';

/** How a task's snapshots are evaluated (`specs.ts`). */
export type TaskEvaluation =
  | {
      readonly kind: 'static';
      /** Repository-relative spec path, as the plan names it. */
      readonly specPath: string;
      readonly specSha256: string;
      readonly evaluator: StepEvaluator;
    }
  | {
      readonly kind: 'frozen-after-step-1';
      readonly contexts: readonly LoopContextDecl[];
      readonly freeze: SpecFreezer;
      /** The evaluator of a frozen spec file (absolute path). */
      readonly evaluatorFor: (specFile: string) => StepEvaluator;
    };

/** A task's style frame and evaluation. */
export interface TaskProfile {
  readonly frame: StyleFrame;
  readonly evaluation: TaskEvaluation;
}

export interface LoopContext {
  readonly outRoot: string;
  readonly tasks: ReadonlyMap<string, LoopTask>;
  readonly agent: StepAgent;
  /** The evaluator of every task without a profile. */
  readonly evaluator: StepEvaluator;
  /** Per-task style frame and spec; a task absent here uses the default frame and `evaluator`. */
  readonly profiles?: ReadonlyMap<string, TaskProfile>;
  readonly typechecker: StepTypechecker;
  /** Fills a fresh, empty work directory with the skeleton. */
  readonly prepareWorkDir: (cwd: string) => DomainResult<void>;
  /** Skeleton integrity after a turn (E1 BR-U5a-45). */
  readonly skeletonIntact: (cwd: string) => boolean;
  /** The exact type-check command the prompts name. */
  readonly typecheckCommand: (runId: string) => string;
  readonly now: () => Date;
  readonly dryRun: boolean;
  readonly log?: (line: string) => void;
}

export type LoopRunResult =
  | { readonly kind: 'skipped-complete'; readonly runId: string }
  | { readonly kind: 'completed'; readonly runId: string; readonly resumedFromStep: number; readonly steps: readonly StepRecord[] };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function runDirFor(outRoot: string, runId: string): string {
  return path.join(outRoot, 'runs', ...runId.split('/'));
}

export function stepRecordPath(runDir: string, stepIndex: number): string {
  return path.join(runDir, STEPS_DIR, `step-${pad(stepIndex + 1)}.json`);
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${String(process.pid)}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** The contiguous step records from step 1 (a gap ends the list). */
export function readStepRecords(runDir: string, steps: number): readonly StepRecord[] {
  const out: StepRecord[] = [];
  for (let i = 0; i < steps; i++) {
    const r = readJsonFile(stepRecordPath(runDir, i)) as StepRecord | null;
    if (r?.schema !== 'loop-step/v1' || r.stepIndex !== i) break;
    out.push(r);
  }
  return out;
}

function sumOrNull(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
}

function identity(f: Pick<BlockingFinding, 'ruleId' | 'filePath' | 'target'>): string {
  return `${f.ruleId}\u0000${f.filePath}\u0000${f.target ?? ''}`;
}

/**
 * Finding by finding, what a repair did: each identity before the repair (rule, file, target; lines ignored), whether
 * the repair prompt listed it and whether it is gone afterwards, and the identities the repair introduced.
 */
export function repairOutcome(before: readonly BlockingFinding[], after: readonly BlockingFinding[]): RepairOutcome {
  const shownIds = new Set(before.slice(0, MAX_REPAIR_FINDINGS).map(identity));
  const afterIds = new Set(after.map(identity));
  const seen = new Set<string>();
  const findings: RepairOutcome['findings'][number][] = [];
  for (const f of before) {
    const id = identity(f);
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push({ ruleId: f.ruleId, filePath: f.filePath, ...(f.target !== undefined ? { target: f.target } : {}), shown: shownIds.has(id), removed: !afterIds.has(id) });
  }
  const introduced: RepairOutcome['introducedFindings'][number][] = [];
  const introducedIds = new Set<string>();
  for (const f of after) {
    const id = identity(f);
    if (seen.has(id) || introducedIds.has(id)) continue;
    introducedIds.add(id);
    introduced.push({ ruleId: f.ruleId, filePath: f.filePath, ...(f.target !== undefined ? { target: f.target } : {}) });
  }
  const removed = findings.filter((f) => f.removed).length;
  return {
    before: findings.length,
    shown: findings.filter((f) => f.shown).length,
    removed,
    remaining: findings.length - removed,
    introduced: introduced.length,
    findings,
    introducedFindings: introduced,
  };
}

interface ResolvedEvaluator {
  readonly evaluator: StepEvaluator | null;
  readonly error?: { readonly code: string; readonly message: string };
  readonly ref?: StepSpecRef;
}

class LoopRun {
  readonly runId: string;
  readonly runDir: string;
  readonly workDir: string;
  readonly snaps: WorkTreeSnapshots;
  private readonly profile: TaskProfile | undefined;
  private lastSpecRef: StepSpecRef | undefined;

  constructor(
    private readonly ctx: LoopContext,
    readonly spec: LoopRunSpec,
    readonly task: LoopTask,
  ) {
    this.runId = loopRunId(spec);
    this.runDir = runDirFor(ctx.outRoot, this.runId);
    this.workDir = path.join(this.runDir, WORK_DIR);
    this.snaps = new WorkTreeSnapshots(path.join(this.runDir, SNAPSHOT_GIT_DIR), this.workDir);
    this.profile = ctx.profiles?.get(task.id);
  }

  /**
   * The evaluator of a snapshot. A frozen spec is inferred once, on the step-1 step-turn snapshot, and read back from
   * `spec/` afterwards (also on resume). A failed freeze is recorded and every snapshot of the run then carries an
   * evaluation error (the commits are kept, so the run can be re-scored).
   */
  private async resolveEvaluator(stepIndex: number, kind: TurnKind, commit: string): Promise<ResolvedEvaluator> {
    const p = this.profile;
    if (p === undefined) return { evaluator: this.ctx.evaluator };
    const e = p.evaluation;
    if (e.kind === 'static') return { evaluator: e.evaluator, ref: { kind: 'static', path: e.specPath, sha256: e.specSha256 } };
    const dir = path.join(this.runDir, SPEC_DIR);
    const specFile = path.join(dir, FROZEN_SPEC_FILE);
    const recFile = path.join(dir, FROZEN_SPEC_RECORD);
    const rel = path.posix.join(SPEC_DIR, FROZEN_SPEC_FILE);
    let rec = readJsonFile(recFile) as FrozenSpecRecord | null;
    if (rec?.schema !== 'loop-frozen-spec/v1') {
      if (stepIndex !== 0 || kind !== 'step') {
        return { evaluator: null, error: { code: 'LOOP_SPEC_NOT_FROZEN', message: 'no frozen spec for this run (it is frozen on the step-1 snapshot)' }, ref: { kind: e.kind, path: rel, sha256: null } };
      }
      const f = await e.freeze(this.workDir, e.contexts);
      const base = { schema: 'loop-frozen-spec/v1' as const, taskId: this.task.id, sourceCommit: commit, frozenAt: this.ctx.now().toISOString() };
      fs.mkdirSync(dir, { recursive: true });
      if (f.success) {
        fs.writeFileSync(path.join(dir, ISE_RAW_FILE), f.data.iseRawYaml);
        fs.writeFileSync(specFile, f.data.specYaml);
        rec = { ...base, status: 'frozen', specSha256: sha256(f.data.specYaml), ise: f.data.ise, constraint: f.data.constraint, check: f.data.check };
      } else {
        const first = f.errors[0];
        rec = { ...base, status: 'failed', specSha256: null, error: { code: first?.code ?? 'LOOP_SPEC_FREEZE_FAILED', message: first?.message ?? 'unknown' } };
      }
      writeJsonAtomic(recFile, rec);
      this.ctx.log?.(`${this.runId}: spec ${rec.status} from step 1 (${commit.slice(0, 12)})`);
    }
    const ref: StepSpecRef = { kind: e.kind, path: rel, sha256: rec.specSha256 };
    if (rec.status !== 'frozen') return { evaluator: null, error: rec.error ?? { code: 'LOOP_SPEC_FREEZE_FAILED', message: 'unknown' }, ref };
    return { evaluator: e.evaluatorFor(specFile), ref };
  }

  /** Creates the run directory (skeleton, snapshot store, base commit, run.json); a half-created one is replaced. */
  private create(): DomainResult<RunRecord> {
    if (fs.existsSync(this.runDir)) fs.rmSync(this.runDir, { recursive: true, force: true });
    fs.mkdirSync(this.runDir, { recursive: true });
    const prep = this.ctx.prepareWorkDir(this.workDir);
    if (!prep.success) return DomainResult.fail(prep.errors);
    const init = this.snaps.init();
    if (!init.success) return DomainResult.fail(init.errors);
    const base = this.snaps.commit('base: skeleton');
    if (!base.success) return DomainResult.fail(base.errors);
    const record: RunRecord = {
      schema: 'loop-run/v1',
      runId: this.runId,
      spec: this.spec,
      steps: this.task.steps.length,
      baseCommit: base.data,
      createdAt: this.ctx.now().toISOString(),
      dryRun: this.ctx.dryRun,
    };
    writeJsonAtomic(path.join(this.runDir, RUN_JSON), record);
    return DomainResult.ok(record);
  }

  private async measure(commit: string, previous: string, stepIndex: number, kind: TurnKind): Promise<DomainResult<SnapshotMeasure>> {
    const diff = this.snaps.diff(previous, commit);
    if (!diff.success) return DomainResult.fail(diff.errors);
    const tc = await this.ctx.typechecker.typecheck(this.runId, this.workDir);
    if (!tc.success) return DomainResult.fail(tc.errors);
    const resolved = await this.resolveEvaluator(stepIndex, kind, commit);
    if (resolved.ref !== undefined) this.lastSpecRef = resolved.ref;
    const ev =
      resolved.evaluator !== null
        ? await resolved.evaluator.evaluate(this.workDir)
        : DomainResult.fail<StepEvaluation>([resolved.error ?? { code: 'LOOP_NO_EVALUATOR', message: 'no evaluator' }]);
    const firstError = ev.success ? undefined : ev.errors[0];
    return DomainResult.ok({
      commit,
      sourceFiles: sourceFilePaths(this.workDir),
      treeFileCount: agentFileCount(this.workDir),
      loc: treeLoc(this.workDir),
      diff: diff.data,
      skeletonIntact: this.ctx.skeletonIntact(this.workDir),
      typecheck: tc.data,
      evaluation: ev.success ? ev.data : null,
      ...(firstError !== undefined ? { evaluationError: { code: firstError.code, message: firstError.message } } : {}),
    });
  }

  private async turn(stepIndex: number, kind: TurnKind, prompt: string, base: string): Promise<DomainResult<TurnRecord>> {
    const turnId = `step-${pad(stepIndex + 1)}${kind === 'repair' ? '-repair' : ''}`;
    const recordDir = path.join(this.runDir, TURNS_DIR, `step-${pad(stepIndex + 1)}`);
    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(path.join(recordDir, `prompt-${turnId}.txt`), prompt);
    const result = await this.ctx.agent.runTurn({
      runId: this.runId,
      turnId,
      taskId: this.task.id,
      kind,
      stepIndex,
      arm: this.spec.arm,
      cwd: this.workDir,
      prompt,
      recordDir,
      changedFiles: () => this.snaps.changedCount(),
      restore: () => this.snaps.restore(base),
      archive: (index) => {
        const rel = path.posix.join(LOOP_INTERRUPTIONS_DIR, this.runId, turnId, String(index));
        try {
          copyTree(this.workDir, path.join(this.ctx.outRoot, ...rel.split('/')));
        } catch (e) {
          return DomainResult.fail([{ code: 'LOOP_ARCHIVE_FAILED', message: e instanceof Error ? e.message : String(e) }]);
        }
        return DomainResult.ok(rel);
      },
    });
    if (!result.success) return DomainResult.fail(result.errors);
    const commit = this.snaps.commit(`${turnId} ${this.spec.arm}`);
    if (!commit.success) return DomainResult.fail(commit.errors);
    const snapshot = await this.measure(commit.data, base, stepIndex, kind);
    if (!snapshot.success) return DomainResult.fail(snapshot.errors);
    return DomainResult.ok({ turnId, kind, promptSha256: sha256(prompt), result: result.data, snapshot: snapshot.data });
  }

  private async step(stepIndex: number, start: string): Promise<DomainResult<StepRecord>> {
    const startedAt = this.ctx.now().toISOString();
    const tcCommand = this.ctx.typecheckCommand(this.runId);
    const first = await this.turn(stepIndex, 'step', stepPrompt(this.task, stepIndex, tcCommand, this.profile?.frame), start);
    if (!first.success) return DomainResult.fail(first.errors);
    const turns: TurnRecord[] = [first.data];
    let repair: StepRecord['repair'] = null;
    let outcome: RepairOutcome | undefined;
    if (this.spec.arm === 'gate') {
      const ev = first.data.snapshot.evaluation;
      if (ev === null || ev.blockingViolationCount === 0) {
        repair = { attempted: false, blockingBefore: ev?.blockingViolationCount ?? null, blockingAfter: null, cleared: null };
      } else {
        const fix = await this.turn(stepIndex, 'repair', repairPrompt(ev.blockingFindings, ev.blockingViolationCount, tcCommand), first.data.snapshot.commit);
        if (!fix.success) return DomainResult.fail(fix.errors);
        turns.push(fix.data);
        const afterEv = fix.data.snapshot.evaluation;
        const after = afterEv?.blockingViolationCount ?? null;
        repair = { attempted: true, blockingBefore: ev.blockingViolationCount, blockingAfter: after, cleared: after === null ? null : after === 0 };
        if (afterEv !== null) outcome = repairOutcome(ev.blockingFindings, afterEv.blockingFindings);
      }
    }
    const last = turns[turns.length - 1] ?? first.data;
    return DomainResult.ok({
      schema: 'loop-step/v1',
      runId: this.runId,
      spec: this.spec,
      stepIndex,
      stepId: this.task.steps[stepIndex]?.id ?? '',
      startedAt,
      finishedAt: this.ctx.now().toISOString(),
      turns,
      repair,
      ...(outcome !== undefined ? { repairOutcome: outcome } : {}),
      ...(this.lastSpecRef !== undefined ? { evaluatorSpec: this.lastSpecRef } : {}),
      finalCommit: last.snapshot.commit,
      cost: {
        costUsd: sumOrNull(turns.map((t) => t.result.usage.costUsd)),
        inputTokens: sumOrNull(turns.map((t) => t.result.usage.inputTokens)),
        outputTokens: sumOrNull(turns.map((t) => t.result.usage.outputTokens)),
        wallMs: turns.reduce((a, t) => a + t.result.wallMs, 0),
      },
    });
  }

  async run(): Promise<DomainResult<LoopRunResult>> {
    const runFile = path.join(this.runDir, RUN_JSON);
    let record = readJsonFile(runFile) as RunRecord | null;
    if (record?.schema !== 'loop-run/v1' || !this.snaps.exists()) {
      const created = this.create();
      if (!created.success) return DomainResult.fail(created.errors);
      record = created.data;
    }
    const steps = this.task.steps.length;
    const done = readStepRecords(this.runDir, steps);
    if (done.length === steps && record.completedAt !== undefined) return DomainResult.ok({ kind: 'skipped-complete', runId: this.runId });

    let last = done[done.length - 1]?.finalCommit ?? record.baseCommit;
    const head = this.snaps.head();
    if (!head.success) return DomainResult.fail(head.errors);
    const dirty = this.snaps.changedCount();
    if (head.data !== last || dirty > 0) {
      const line = { at: this.ctx.now().toISOString(), resumeAtStep: done.length + 1, restoredTo: last, discardedHead: head.data, discardedChanges: dirty };
      fs.appendFileSync(path.join(this.runDir, RESTARTS_LOG), `${JSON.stringify(line)}\n`);
      this.ctx.log?.(`${this.runId}: partial step ${String(done.length + 1)} discarded, resuming`);
    }
    // Step records written after the gap (none normally) are stale; they are replaced as the steps rerun. A spec frozen
    // on a discarded step 1 is discarded with it.
    if (done.length === 0) fs.rmSync(path.join(this.runDir, SPEC_DIR), { recursive: true, force: true });
    const restored = this.snaps.restore(last);
    if (!restored.success) return DomainResult.fail(restored.errors);

    const records: StepRecord[] = [...done];
    for (let i = done.length; i < steps; i++) {
      const r = await this.step(i, last);
      if (!r.success) return DomainResult.fail(r.errors);
      writeJsonAtomic(stepRecordPath(this.runDir, i), r.data);
      records.push(r.data);
      last = r.data.finalCommit;
      this.ctx.log?.(`${this.runId}: step ${String(i + 1)}/${String(steps)} ${describeStep(r.data)}`);
    }
    writeJsonAtomic(runFile, { ...record, completedAt: this.ctx.now().toISOString() });
    return DomainResult.ok({ kind: 'completed', runId: this.runId, resumedFromStep: done.length, steps: records });
  }
}

/** One-line summary of a step for the console. */
export function describeStep(r: StepRecord): string {
  const last = r.turns[r.turns.length - 1];
  const ev = last?.snapshot.evaluation;
  const blocking = ev !== undefined && ev !== null ? String(ev.blockingViolationCount) : 'n/a';
  const ahs = ev?.ahs !== undefined && ev.ahs !== null ? ev.ahs.toFixed(3) : 'n/a';
  const repair = r.repair?.attempted === true ? ` repair ${String(r.repair.blockingBefore)}→${String(r.repair.blockingAfter)}` : '';
  return `${last?.result.status ?? 'n/a'} files=${String(last?.snapshot.sourceFiles.length ?? 0)} loc=${String(last?.snapshot.loc ?? 0)} blocking=${blocking} ahs=${ahs}${repair}`;
}

/** Runs (or resumes) one loop run. */
export async function runLoop(ctx: LoopContext, spec: LoopRunSpec): Promise<DomainResult<LoopRunResult>> {
  const task = ctx.tasks.get(spec.taskId);
  if (task === undefined) return DomainResult.fail([{ code: 'LOOP_TASK_UNKNOWN', message: `no task ${spec.taskId}` }]);
  if (ctx.agent.adapterId !== spec.adapterId || ctx.agent.modelId !== spec.modelId) {
    return DomainResult.fail([{ code: 'LOOP_AGENT_MISMATCH', message: `the agent is ${ctx.agent.adapterId}/${ctx.agent.modelId}, the run needs ${spec.adapterId}/${spec.modelId}` }]);
  }
  return new LoopRun(ctx, spec, task).run();
}
