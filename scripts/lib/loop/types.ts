/**
 * Types of the v1.3 firewall-in-the-loop multi-step harness (FR-V12 design support; Study 2 is NOT pre-registered,
 * see `Docs/v1.3/study2-outline.md`).
 *
 * A loop task is a sequence of k feature steps applied to the SAME project directory: step 1 creates the system,
 * steps 2..k extend it. A loop run is one (adapter, model, task, arm, run index) tuple; its steps run in order in one
 * work directory, and after every step the harness snapshots the tree (a commit in a git store kept outside the work
 * directory), type-checks it and evaluates it with the firewall.
 *
 * Nothing here names a real study task: the tasks come from a tasks file supplied at run time. The tests and the
 * example use made-up demo tasks only.
 */
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GeneratorAdapterId, GenerationAttempt, GenerationInterruption } from '../generators/types.js';

export type { DomainResult };

/**
 * Arms of the loop study.
 * - `none`: no firewall; the E1 confinement argv (Claude) or argument set (Codex), unchanged.
 * - `daedalus-mcp`: the DaedalusArch spec-only MCP tools are available while the agent writes each step.
 * - `gate`: no tools during the step; after it the firewall runs, and when it reports blocking findings the agent
 *   gets them and exactly one repair turn.
 */
export type LoopArm = 'none' | 'daedalus-mcp' | 'gate';

export const LOOP_ARMS: readonly LoopArm[] = Object.freeze(['none', 'daedalus-mcp', 'gate']);

export interface LoopStep {
  /** `[a-z0-9-]+`, unique within the task. */
  readonly id: string;
  /** The feature request of this step (step 1 creates the system; later steps extend it). */
  readonly request: string;
}

export interface LoopTask {
  /** `[a-z0-9-]+`. */
  readonly id: string;
  readonly title: string;
  readonly steps: readonly LoopStep[];
}

export interface LoopTasksFile {
  /** Free text; a demo file says it is a demo. */
  readonly description: string;
  readonly tasks: readonly LoopTask[];
}

/** One loop run of the grid. */
export interface LoopRunSpec {
  readonly adapterId: GeneratorAdapterId;
  readonly modelId: string;
  readonly taskId: string;
  readonly arm: LoopArm;
  readonly runIndex: number;
}

/** Kind of an agent turn: the step itself, or the gate arm's repair turn after it. */
export type TurnKind = 'step' | 'repair';

/** Token and cost figures of one turn, read tolerantly from the CLI envelope (absent fields are null). */
export interface TurnUsage {
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheCreationTokens: number | null;
  readonly numTurns: number | null;
  /** The envelope's own `duration_ms`. */
  readonly durationMs: number | null;
}

export const EMPTY_USAGE: TurnUsage = Object.freeze({
  costUsd: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheCreationTokens: null,
  numTurns: null,
  durationMs: null,
});

/**
 * How a turn ended. `completed` is the only state in which the agent finished normally; every other state is still
 * snapshotted and measured (the tree is what the agent left), never retried beyond the BR-U5a-50 policy.
 */
export type TurnStatus = 'completed' | 'agent-error' | 'timeout' | 'infrastructure' | 'envelope-unreadable' | 'model-mismatch';

export interface TurnInput {
  /** Loop run id: `<adapter>/<model>/<task>/<arm>/run-<r>` (keys `<H>/runs/<runId>/`). */
  readonly runId: string;
  /** `step-01` or `step-01-repair`. */
  readonly turnId: string;
  readonly taskId: string;
  readonly kind: TurnKind;
  readonly stepIndex: number;
  readonly arm: LoopArm;
  /** The work directory (the agent's cwd); it holds the tree of every earlier step. */
  readonly cwd: string;
  /** The full prompt of the turn (the arm's tool sentence is added by the agent, not here). */
  readonly prompt: string;
  /** Harness-owned directory of this turn's records (outside `cwd`). */
  readonly recordDir: string;
  /** Files the agent changed since the last snapshot (decides "timeout with files written"). */
  readonly changedFiles: () => number;
  /** Puts `cwd` back to the last snapshot (before an infrastructure retry or after a usage-limit interruption). */
  readonly restore: () => DomainResult<void>;
  /** Copies the interrupted tree aside; returns its path relative to the grid `outRoot` (POSIX). */
  readonly archive: (index: number) => DomainResult<string>;
}

export interface TurnResult {
  readonly status: TurnStatus;
  readonly usage: TurnUsage;
  /** Wall time of the turn as the harness measured it, retries and usage-limit pauses included. */
  readonly wallMs: number;
  readonly attempts: readonly GenerationAttempt[];
  readonly interruptions: readonly GenerationInterruption[];
  /** The argv of the last call with the prompt replaced by `<prompt>` (Codex takes the prompt on stdin). */
  readonly argv: readonly string[];
  /** Scrubbed envelope, relative to the run directory; null when none was written. */
  readonly envelopePath: string | null;
  readonly permissionDenials: number;
}

/** A generator that runs one turn in a work directory (Claude Code, Codex, or the dry-run stub). */
export interface StepAgent {
  readonly adapterId: GeneratorAdapterId;
  readonly modelId: string;
  runTurn(input: TurnInput): Promise<DomainResult<TurnResult>>;
}

/** One blocking finding the firewall reports (what the gate arm shows the agent). */
export interface BlockingFinding {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly filePath: string;
  readonly line?: number;
  readonly target?: string;
  readonly message: string;
}

/** The firewall evaluation of one snapshot (v1.3 scoring, FR-V6). */
export interface StepEvaluation {
  readonly scoringMode: 'v1.3';
  /** The v1.2E symbolic AHS (unchanged by v1.3 scoring); null when no rule ran. */
  readonly ahs: number | null;
  /** AHS over the blocking rules only; null when none ran. */
  readonly blockingAhs: number | null;
  /** v1.3 verdict: `fail` iff a blocking rule has an applicable violation. */
  readonly verdict: 'pass' | 'fail';
  readonly violationCount: number;
  readonly blockingViolationCount: number;
  readonly advisoryViolationCount: number;
  /** Blocking violations per rule id. */
  readonly blockingByRule: Readonly<Record<string, number>>;
  /** The listed blocking findings (each rule capped as `evaluate_project` caps it). */
  readonly blockingFindings: readonly BlockingFinding[];
  readonly durationMs: number;
}

/** The firewall run on a snapshot. A failure here is recorded on the step, never retried silently. */
export interface StepEvaluator {
  readonly id: string;
  evaluate(projectDir: string): Promise<DomainResult<StepEvaluation>>;
}

export interface TypecheckResult {
  readonly errors: number;
  /** `TSnnnn` codes (or a synthetic `TSC_EXIT_<n>` / `TSC_TIMEOUT`), in output order, at most 50. */
  readonly codes: readonly string[];
}

/** The type-check of record of a snapshot. */
export interface StepTypechecker {
  typecheck(runId: string, cwd: string): Promise<DomainResult<TypecheckResult>>;
}

/** Everything measured on one snapshot of the work tree. */
export interface SnapshotMeasure {
  /** Commit of the snapshot in the run's git store. */
  readonly commit: string;
  /** `src/**\/*.ts` files (BR-U5a-48 file set), `src`-relative, sorted. */
  readonly sourceFiles: readonly string[];
  /** Every file of the tree except the skeleton (`package.json`, `node_modules`). */
  readonly treeFileCount: number;
  /** Non-blank lines of the source files (the SO5 LOC rule, `treeLoc`). */
  readonly loc: number;
  /** Files added, modified and deleted relative to the previous snapshot. */
  readonly diff: { readonly added: number; readonly modified: number; readonly deleted: number };
  readonly skeletonIntact: boolean;
  readonly typecheck: TypecheckResult | null;
  readonly evaluation: StepEvaluation | null;
  /** Code and message when the evaluator failed (the step is kept; the outcome is missing). */
  readonly evaluationError?: { readonly code: string; readonly message: string };
}

export interface TurnRecord {
  readonly turnId: string;
  readonly kind: TurnKind;
  readonly promptSha256: string;
  readonly result: TurnResult;
  readonly snapshot: SnapshotMeasure;
}

/** `steps/step-<nn>.json` of a loop run: the step's turn(s) and its final snapshot. */
export interface StepRecord {
  readonly schema: 'loop-step/v1';
  readonly runId: string;
  readonly spec: LoopRunSpec;
  readonly stepIndex: number;
  readonly stepId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly turns: readonly TurnRecord[];
  /** Gate arm: whether a repair turn ran and whether it cleared every blocking finding. */
  readonly repair: { readonly attempted: boolean; readonly blockingBefore: number | null; readonly blockingAfter: number | null; readonly cleared: boolean | null } | null;
  /**
   * Gate arm, when a repair ran and both snapshots were evaluated: finding by finding, which blocking findings the
   * repair removed and which it introduced (`repairOutcome` in `loop.ts`).
   */
  readonly repairOutcome?: RepairOutcome;
  /** The spec the step's snapshots were evaluated against, when the plan sets one per task (`specs.ts`). */
  readonly evaluatorSpec?: StepSpecRef;
  /** Commit the next step starts from (the last turn's snapshot). */
  readonly finalCommit: string;
  /** Sum over the turns. */
  readonly cost: { readonly costUsd: number | null; readonly inputTokens: number | null; readonly outputTokens: number | null; readonly wallMs: number };
}

/**
 * Identity of a blocking finding across snapshots: rule id, file and target; line numbers are ignored because they
 * move (`Docs/v1.3/pilot-outcome-memo.md` §3).
 */
export interface RepairFindingOutcome {
  readonly ruleId: string;
  readonly filePath: string;
  readonly target?: string;
  /** Listed in the repair prompt (at most `MAX_REPAIR_FINDINGS` are). */
  readonly shown: boolean;
  /** No finding with the same identity remains after the repair. */
  readonly removed: boolean;
}

/** What the gate's repair turn did to the blocking findings, by identity (null counts when the evaluation failed). */
export interface RepairOutcome {
  /** Distinct identities before the repair. */
  readonly before: number;
  readonly shown: number;
  readonly removed: number;
  readonly remaining: number;
  /** Identities after the repair that were not there before. */
  readonly introduced: number;
  readonly findings: readonly RepairFindingOutcome[];
  readonly introducedFindings: readonly { readonly ruleId: string; readonly filePath: string; readonly target?: string }[];
}

/** The evaluator spec of a step: a fixed file, or the run's spec frozen after step 1 (`spec/frozen-spec.yaml`). */
export interface StepSpecRef {
  readonly kind: 'static' | 'frozen-after-step-1';
  /** Repository-relative for a static spec; run-directory-relative for a frozen one. */
  readonly path: string;
  /** Null when no spec could be frozen. */
  readonly sha256: string | null;
}

/** `run.json` of a loop run: written once when the run directory is created, completed when the last step is done. */
export interface RunRecord {
  readonly schema: 'loop-run/v1';
  readonly runId: string;
  readonly spec: LoopRunSpec;
  readonly steps: number;
  readonly baseCommit: string;
  readonly createdAt: string;
  readonly completedAt?: string;
  readonly dryRun: boolean;
}
