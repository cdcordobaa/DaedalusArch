/**
 * Shared step-1 start (Stage B of the exploratory study; drift record `Docs/v1.4/study2-deviation-2026-10-19-drift.md`
 * §2, `start=shared-step-1`; unit U13).
 *
 * A plan with `sharedStart: { fromOutRoot, fromCell, step: 1 }` does not run step 1. For each of its runs
 * (adapter, model, task, run index r) the source run is `<adapter>/<model>/<task>/<fromCell arm>/run-<r>` under
 * `fromOutRoot` (one root for every replicate, or an array indexed by run index). When the run directory is created:
 * - the source is checked, and the run is refused when anything differs (`checkSharedStartSource`): the source run,
 *   its step-1 record or its step-1 `finalCommit` in the source's `snapshots.git` is missing; the source's
 *   `schedule.json` tasks sha256 differs from this grid's; its step-1 evaluator spec sha256 differs from this task's;
 *   its arm, rung or attention flag is not `fromCell`'s and this plan's; or it is a dry run and this one is not (or the
 *   other way round);
 * - the new `snapshots.git` fetches the step-1 commit (with its ancestry: the skeleton base commit and the step-1 turn
 *   commits) from the source store, and the work tree is reset to it, so the tree at step 1 is the source's, commit
 *   for commit;
 * - the source's step-1 record is copied to `steps/step-01.json` under this run's id and spec, with an `inherited`
 *   block naming the source, and the source's `turns/step-01/` (prompt, envelope, report) is copied beside it, so the
 *   run's history up to step 1 is what a run of its own would hold;
 * - `run.json` gets a `sharedStart` block (source run id, commits, the step-1 record's sha256, the tasks and spec
 *   hashes). No absolute path is recorded.
 * The loop then resumes at step 2 like any run with one step done: the step-2 frame is the one a run at step 2 sees
 * (this plan's rung and arm), and every outcome computed from the step records (`pilot-metrics.ts` `runOutcomes`, the
 * drift D of `scripts/lib/drift/`) finds the inherited step-1 identities in step 1, so they never count as new.
 * A resume needs only the new run: its `run.json` must name the source this plan names (`LOOP_SHARED_START_MISMATCH`).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../src/shared/errors/domain-result.js';
import type { SpecRung } from './prompts.js';
import { SPEC_RUNGS } from './prompts.js';
import { LOOP_ARMS } from './types.js';
import type { LoopArm, LoopRunSpec, LoopTask, RunRecord, StepRecord } from './types.js';

/** The plan's `sharedStart` block. */
export interface SharedStartPlan {
  /** Absolute out-root of the source grid: one for every run index, or one per run index. */
  readonly fromOutRoot: string | readonly string[];
  /** `<arm>@<rung>` of the source cell (`none@L2`); `mcp` stands for `daedalus-mcp`. */
  readonly fromCell: string;
  /** The step whose tree is shared; only 1. */
  readonly step: 1;
}

/** `run.json` `sharedStart`: where the run's step 1 came from. */
export interface SharedStartRecord {
  readonly fromCell: string;
  readonly step: 1;
  readonly sourceRunId: string;
  /** The source's step-1 `finalCommit`: this run's step-1 tree. */
  readonly sourceCommit: string;
  readonly sourceBaseCommit: string;
  /** sha256 of the source's `steps/step-01.json` bytes. */
  readonly sourceStepRecordSha256: string;
  readonly tasksSha256: string;
  readonly specSha256: string;
}

/** `steps/step-01.json` `inherited` of a shared-start run: the record is the source's, not drawn by this run. */
export interface InheritedStep {
  readonly sourceRunId: string;
  readonly sourceSpec: LoopRunSpec;
  readonly sourceStepRecordSha256: string;
}

/** What the loop needs to branch a run (`LoopContext.sharedStart`, built by `main.ts`). */
export interface SharedStartContext {
  readonly fromCell: string;
  readonly fromArm: LoopArm;
  readonly fromRung: SpecRung;
  /** sha256 of this grid's tasks file; the source's `schedule.json` must record the same. */
  readonly tasksSha256: string;
  /** The source out-root of a run index (absolute). */
  readonly fromOutRootFor: (runIndex: number) => string | undefined;
}

export const SHARED_START_STEP = 1;
const SCHEDULE_JSON = 'schedule.json';
const SHA_RE = /^[0-9a-f]{40}$/;

function err(code: string, message: string): DomainError {
  return { code, message };
}

/** `none@L2` → arm `none`, rung `L2` (`mcp` = `daedalus-mcp`); undefined when malformed. */
export function parseCell(cell: unknown): { readonly arm: LoopArm; readonly rung: SpecRung } | undefined {
  if (typeof cell !== 'string') return undefined;
  const m = /^([a-z-]+)@(L\d)$/.exec(cell);
  if (m === null) return undefined;
  const arm = m[1] === 'mcp' ? 'daedalus-mcp' : m[1];
  const rung = m[2];
  if (!(LOOP_ARMS as readonly unknown[]).includes(arm) || !(SPEC_RUNGS as readonly unknown[]).includes(rung)) return undefined;
  return { arm: arm as LoopArm, rung: rung as SpecRung };
}

/** The out-roots a block names, as a list (one entry: every run index). */
export function fromOutRoots(s: Pick<SharedStartPlan, 'fromOutRoot'>): readonly string[] {
  return typeof s.fromOutRoot === 'string' ? [s.fromOutRoot] : s.fromOutRoot;
}

/** The source out-root of a run index. */
export function fromOutRootFor(s: Pick<SharedStartPlan, 'fromOutRoot'>, runIndex: number): string | undefined {
  return typeof s.fromOutRoot === 'string' ? s.fromOutRoot : s.fromOutRoot[runIndex];
}

/** Plan validation of `sharedStart` (shape only; the plan-wide rules are in `plan.ts`). */
export function validateSharedStart(raw: unknown, lastRunIndex: number | undefined): DomainError[] {
  const bad = (m: string): DomainError => err('LOOP_PLAN_INVALID', `sharedStart ${m}`);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [bad('must be { fromOutRoot, fromCell, step: 1 }')];
  const r = raw as Record<string, unknown>;
  const errors: DomainError[] = [];
  if (Object.keys(r).some((k) => !['fromOutRoot', 'fromCell', 'step'].includes(k))) errors.push(bad('has only fromOutRoot, fromCell and step'));
  const roots = typeof r.fromOutRoot === 'string' ? [r.fromOutRoot] : r.fromOutRoot;
  if (!Array.isArray(roots) || roots.length === 0 || !roots.every((p) => typeof p === 'string' && path.isAbsolute(p))) {
    errors.push(bad('fromOutRoot must be an absolute path, or a non-empty list of them indexed by run index'));
  } else if (Array.isArray(r.fromOutRoot) && lastRunIndex !== undefined && roots.length <= lastRunIndex) {
    errors.push(bad(`fromOutRoot lists ${String(roots.length)} roots but the plan runs run index ${String(lastRunIndex)}`));
  }
  if (parseCell(r.fromCell) === undefined) errors.push(bad('fromCell must be <arm>@<rung>, e.g. none@L2'));
  if (r.step !== SHARED_START_STEP) errors.push(bad('step must be 1 (only the step-1 tree can be shared)'));
  return errors;
}

function sha256Bytes(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** A checked source: its run directory, records and the step-1 commit to seed from. */
export interface SharedStartSeed {
  readonly sourceRunDir: string;
  readonly sourceGitDir: string;
  readonly stepRecord: StepRecord;
  readonly record: SharedStartRecord;
}

export interface SourceCheckInput {
  readonly ctx: SharedStartContext;
  readonly spec: LoopRunSpec;
  readonly task: LoopTask;
  /** This run's step-1 evaluator spec sha256 (a static profile's). */
  readonly specSha256: string | undefined;
  /** This plan's attention flag. */
  readonly attention: boolean;
  readonly dryRun: boolean;
  /** `<outRoot>/runs/<runId>` of a run id under an out-root (`loop.ts` `runDirFor`). */
  readonly runDirFor: (outRoot: string, runId: string) => string;
  readonly runIdOf: (spec: LoopRunSpec) => string;
  /** Whether a commit exists in a git store. */
  readonly hasCommit: (gitDir: string, commit: string) => boolean;
  readonly snapshotGitDir: string;
}

/** Checks the source of a shared-start run (module header); every refusal is `LOOP_SHARED_START_SOURCE`. */
export function checkSharedStartSource(i: SourceCheckInput): DomainResult<SharedStartSeed> {
  const sourceSpec: LoopRunSpec = { ...i.spec, arm: i.ctx.fromArm };
  const sourceRunId = i.runIdOf(sourceSpec);
  const refuse = (m: string): DomainResult<SharedStartSeed> => DomainResult.fail([err('LOOP_SHARED_START_SOURCE', `${i.runIdOf(i.spec)}: source ${sourceRunId}: ${m}`)]);
  const outRoot = i.ctx.fromOutRootFor(i.spec.runIndex);
  if (outRoot === undefined) return refuse(`no fromOutRoot for run index ${String(i.spec.runIndex)}`);
  const schedule = readJson(path.join(outRoot, SCHEDULE_JSON)) as { tasksSha256?: unknown } | null;
  if (schedule === null) return refuse(`the source grid has no readable ${SCHEDULE_JSON}`);
  if (schedule.tasksSha256 !== i.ctx.tasksSha256) {
    return refuse(`the source grid's tasks sha256 ${String(schedule.tasksSha256)} differs from this grid's ${i.ctx.tasksSha256}`);
  }
  const runDir = i.runDirFor(outRoot, sourceRunId);
  const run = readJson(path.join(runDir, 'run.json')) as RunRecord | null;
  if (run?.schema !== 'loop-run/v1' || run.runId !== sourceRunId) return refuse('the source run is missing (no run.json)');
  if (run.dryRun !== i.dryRun) return refuse(`the source is ${run.dryRun ? 'a dry run' : 'a live run'}, this grid is not`);
  const rung = run.frame?.specRung ?? 'L2';
  const attention = run.frame?.attention ?? false;
  if (rung !== i.ctx.fromRung) return refuse(`the source ran at ${rung}, fromCell is ${i.ctx.fromCell}`);
  if (attention !== i.attention) return refuse(`the source ran with attention ${String(attention)}, this plan with ${String(i.attention)}`);
  if (run.steps !== i.task.steps.length) return refuse(`the source run has ${String(run.steps)} steps, the task ${String(i.task.steps.length)}`);
  const stepFile = path.join(runDir, 'steps', 'step-01.json');
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(stepFile);
  } catch {
    return refuse('the source has no step-1 record');
  }
  let step: StepRecord | null = null;
  try {
    step = JSON.parse(bytes.toString('utf8')) as StepRecord;
  } catch {
    step = null;
  }
  if (step?.schema !== 'loop-step/v1' || step.stepIndex !== 0 || step.runId !== sourceRunId) return refuse('the source step-1 record is unreadable');
  if (step.stepId !== i.task.steps[0]?.id) return refuse(`the source step 1 is ${step.stepId}, the task's is ${i.task.steps[0]?.id ?? '?'}`);
  if (typeof step.finalCommit !== 'string' || !SHA_RE.test(step.finalCommit)) return refuse('the source step-1 record has no finalCommit');
  const gitDir = path.join(runDir, i.snapshotGitDir);
  if (!i.hasCommit(gitDir, step.finalCommit)) return refuse(`commit ${step.finalCommit} is not in the source ${i.snapshotGitDir}`);
  if (!i.hasCommit(gitDir, run.baseCommit)) return refuse(`base commit ${run.baseCommit} is not in the source ${i.snapshotGitDir}`);
  const sourceSpecSha = step.evaluatorSpec?.sha256 ?? null;
  if (i.specSha256 === undefined || sourceSpecSha === null || sourceSpecSha !== i.specSha256) {
    return refuse(`the source step-1 spec sha256 ${String(sourceSpecSha)} differs from this task's ${String(i.specSha256 ?? null)}`);
  }
  return DomainResult.ok({
    sourceRunDir: runDir,
    sourceGitDir: gitDir,
    stepRecord: step,
    record: {
      fromCell: i.ctx.fromCell,
      step: SHARED_START_STEP,
      sourceRunId,
      sourceCommit: step.finalCommit,
      sourceBaseCommit: run.baseCommit,
      sourceStepRecordSha256: sha256Bytes(bytes),
      tasksSha256: i.ctx.tasksSha256,
      specSha256: i.specSha256,
    },
  });
}

/** The source's step-1 record under this run's id and spec, marked `inherited`. */
export function inheritedStepRecord(seed: SharedStartSeed, runId: string, spec: LoopRunSpec): StepRecord {
  const inherited: InheritedStep = { sourceRunId: seed.record.sourceRunId, sourceSpec: seed.stepRecord.spec, sourceStepRecordSha256: seed.record.sourceStepRecordSha256 };
  return { ...seed.stepRecord, runId, spec, inherited };
}

/**
 * The resume check: a run created from a shared start must be resumed with the same source, and a run created without
 * one must not be resumed with one.
 */
export function sharedStartMatches(record: RunRecord, expectedSourceRunId: string | undefined, runId: string): DomainResult<void> {
  const got = record.sharedStart?.sourceRunId;
  if (got === expectedSourceRunId) return DomainResult.ok(undefined);
  return DomainResult.fail([
    err('LOOP_SHARED_START_MISMATCH', `${runId}: run.json records shared start ${JSON.stringify(got ?? null)}, the plan ${JSON.stringify(expectedSourceRunId ?? null)}; use a fresh outRoot`),
  ]);
}
