/**
 * Loop fault drills (backlog 2026-10-16 #7, S1; readiness gate lines S1, D7, D14): the loop harness meets the faults
 * Study 1 met, with the scripted replay agent of `scripts/lib/loop/replay.ts` (no LLM call anywhere), and must resume
 * to the same bytes as an undisturbed replay. Report: `Docs/v1.3/loop-fault-drills.md`.
 *
 * Engine: `cypher-interp` (the in-process interpreter; no Neo4j). Every drill runs one (task, arm) of the pilot replay
 * tapes in a fresh outRoot, in child processes: phase 1 with the fault armed, phase 2 (and more, if a phase stops
 * again) with no fault, each a fresh process, exactly as an operator re-running the same command would.
 *
 * THIS FILE WAS COMMITTED FIRST WITH ONLY THE DRILL LIST AND THE PASS CRITERION (rule 11); the implementation came in
 * a later commit and did not change either.
 */

/** How the drill reaches the loop. */
export type DrillAgentShape =
  /** `ScriptedStepAgent` as the loop replay uses it. */
  | 'direct'
  /**
   * `ClaudeStepAgent` (E1 argv, `runWithRetries`, envelope parsing, `attemptDisposition`) over a scripted
   * `ProcessRunner` that plays the CLI: the turn's edits come from the same tapes, the stdout is a CLI envelope.
   * Needed for the usage-limit drills, whose classification lives in that path.
   */
  | 'cli';

export interface DrillDef {
  readonly id: string;
  /** The backlog drill this one instantiates (D1..D7). */
  readonly family: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7';
  readonly taskId: string;
  readonly arm: 'none' | 'gate';
  readonly shape: DrillAgentShape;
  /** The turn whose processing the fault hits (`step-NN` or `step-NN-repair`); D7 has none. */
  readonly turnId: string | null;
  readonly fault:
    | 'sigkill-in-turn'
    | 'sigkill-before-score'
    | 'sigkill-after-score'
    | 'usage-limit-once'
    | 'usage-limit-persists'
    | 'pipeline-throws'
    | 'graph-unreachable'
    | 'tsc-exit-no-diagnostics'
    | 'tsc-spawn-fails'
    | 'enospc-snapshot-store'
    | 'truncate-step-record';
  readonly what: string;
  /** What phase 1 must leave on disk or return so the fault is classified (checked, not just described). */
  readonly expectClassification: string;
}

const MARKET = 'market-vendors';
const RELIEF = 'relief-volunteers';

export const DRILLS: readonly DrillDef[] = Object.freeze([
  {
    id: 'D1a',
    family: 'D1',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'sigkill-in-turn',
    what: 'SIGKILL inside the step-3 turn, after its edits are on disk and before the turn returns (no commit).',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step in restarts.jsonl (resumeAtStep 3, discardedChanges > 0)',
  },
  {
    id: 'D1b',
    family: 'D1',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02-repair',
    fault: 'sigkill-in-turn',
    what: "SIGKILL inside the gate's step-2 repair turn (the step turn is committed and scored; the repair's edits are on disk).",
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step (resumeAtStep 2, discardedHead = the step-2 step-turn commit)',
  },
  {
    id: 'D2a',
    family: 'D2',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'sigkill-before-score',
    what: 'SIGKILL after the step-2 snapshot commit, when the type-check of record starts (before any scoring).',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded partial step (resumeAtStep 2, discardedHead = the unscored commit)',
  },
  {
    id: 'D2b',
    family: 'D2',
    taskId: RELIEF,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-01',
    fault: 'sigkill-after-score',
    what: 'DDD task: SIGKILL right after the step-1 evaluation, when the spec is already frozen in spec/ and no step record exists.',
    expectClassification: 'process killed by SIGKILL; resume logs the discarded step 1 and re-freezes the spec from the rerun step 1',
  },
  {
    id: 'D3a',
    family: 'D3',
    taskId: MARKET,
    arm: 'gate',
    shape: 'cli',
    turnId: 'step-02',
    fault: 'usage-limit-once',
    what: "The CLI's first step-2 call writes part of the step and answers the E1 usage-limit envelope (exit 1, \"You've hit your limit · resets …|<epoch>\"); the retry policy pauses (injected sleeper) and the same turn resumes.",
    expectClassification: "phase 1 completes; the step-2 turn records one interruption (interruptions[0].movedTo = interruptions/<runId>/step-02/0) and the archived partial tree exists",
  },
  {
    id: 'D3b',
    family: 'D3',
    taskId: MARKET,
    arm: 'gate',
    shape: 'cli',
    turnId: 'step-03',
    fault: 'usage-limit-persists',
    what: 'The usage limit persists beyond the policy (maxInterruptions = 1 in this drill, two limit envelopes in a row): the run stops.',
    expectClassification: 'phase 1 fails with GEN_USAGE_LIMIT_PERSISTS and no step-3 record; resume reruns step 3',
  },
  {
    id: 'D4a',
    family: 'D4',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'pipeline-throws',
    what: "cypher-interp: the evaluation pipeline throws on the step-2 step-turn snapshot (the step the gate must repair).",
    expectClassification: 'the evaluation error (PIPELINE_FAILED) is recorded or stops the run; the gate never proceeds as if the step were clean',
  },
  {
    id: 'D4b',
    family: 'D4',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'graph-unreachable',
    what: 'The --engine neo4j failure mode without a server: the graph health check fails on the step-2 snapshot (NEO4J_UNREACHABLE).',
    expectClassification: 'NEO4J_UNREACHABLE recorded or stops the run; the gate never proceeds as if the step were clean',
  },
  {
    id: 'D4c',
    family: 'D4',
    taskId: MARKET,
    arm: 'none',
    shape: 'direct',
    turnId: 'step-02',
    fault: 'pipeline-throws',
    what: 'The same thrown pipeline error in the none arm (no decision depends on the score).',
    expectClassification: 'PIPELINE_FAILED recorded as the step-2 snapshot evaluationError',
  },
  {
    id: 'D5a',
    family: 'D5',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'tsc-exit-no-diagnostics',
    what: 'The type-check of record exits 2 with no diagnostics on the step-3 snapshot (E1 harnessTypechecker mapping, fake runner).',
    expectClassification: 'the snapshot carries the synthetic code TSC_EXIT_2 (not a TS diagnostic)',
  },
  {
    id: 'D5b',
    family: 'D5',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'tsc-spawn-fails',
    what: 'The type-check of record cannot be spawned on the step-3 snapshot.',
    expectClassification: 'phase 1 fails with PROCESS_SPAWN_FAILED and no step-3 record',
  },
  {
    id: 'D6',
    family: 'D6',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: 'step-03',
    fault: 'enospc-snapshot-store',
    what: 'The snapshot store sits on a tmpfs that is full when the step-3 snapshot is committed (real ENOSPC); the filler is removed before resume.',
    expectClassification: 'phase 1 fails with LOOP_SNAPSHOT_GIT naming the space error, and no step-3 record',
  },
  {
    id: 'D7',
    family: 'D7',
    taskId: MARKET,
    arm: 'gate',
    shape: 'direct',
    turnId: null,
    fault: 'truncate-step-record',
    what: 'A completed run whose steps/step-02.json is cut to half its bytes.',
    expectClassification: 'resume says why it reruns from step 2 (the step-2 record is unreadable), not only that it does',
  },
] satisfies DrillDef[]);

/**
 * The pass criterion, fixed before any drill ran. A drill passes iff all three hold:
 *
 * (i) Classified. Phase 1 leaves the fault visible as `expectClassification` says (a process signal or failure code,
 *     an interruption, an evaluation error, a type-check code, or a restart line that says why).
 * (ii) Byte-identical after resume. Phases 2.. run with no fault until the run completes; then the drill's outRoot
 *     equals the undisturbed replay of the same (task, arm, agent shape) under `canonicalTree` / `compareReplays` of
 *     `scripts/lib/loop/replay-verify.ts` (#142's comparer: timing keys zeroed, `timing-*.json` excluded, snapshot
 *     stores compared by `git log` of commit, tree and subject), EXCEPT the fault record itself, and nothing else:
 *       - `runs/<runId>/restarts.jsonl`;
 *       - `runs/<runId>/discarded/**` (partial-step records set aside by a resume, if the harness keeps any);
 *       - `interruptions/**` (usage-limit archives);
 *       - for D3a only, the `result.interruptions` array of the faulted turn in its step record.
 * (iii) No duplicated turn, no skipped step, no silent arm conversion: per step, the list of turn kinds, the repair
 *     record and the final commit equal the undisturbed replay's (implied by (ii); checked and reported separately so
 *     a failure names its kind).
 *
 * A drill that fails (ii) or (iii) is a defect. A defect that makes the gate arm behave as `none` (R01 family) is
 * blocking and is fixed with a failing test first; other defects are fixed only when they are pure bug fixes with a
 * test, otherwise reported for the author. Nothing about the clean path may change: the undisturbed replays must still
 * match each other byte for byte.
 */
export const PASS_CRITERION_VERSION = 'loop-fault-drills/pass/v1';
