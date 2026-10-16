/**
 * Types of the diff-aware gate (`check --base <ref> --head <ref>`, Docs/v1.3/ci-gate.md). A finding is one tool row
 * of one commit; the gate sorts the rows of two commits into new, fixed and unchanged.
 */

/** `not-applicable`: a row of a partial rule's N/A part (FF-P06 FLOWS_TO), reported but never counted. */
export type GateTier = 'blocking' | 'advisory' | 'not-applicable';

export interface GateFinding {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly tier: GateTier;
  /** Project-relative, forward slashes. A cycle row (FF-S02) carries the cycle path, comma-separated. */
  readonly file: string;
  readonly target?: string;
  /** 1-based; informative only, never part of the matching key (line drift is tolerated). */
  readonly line?: number;
  readonly message: string;
  /** Fix hint from the report catalogue (`formatActionableViolation`) or `check_file`; absent when none exists. */
  readonly fix?: string;
}

/** What one commit evaluated to. */
export interface CommitEvaluation {
  readonly ref: string;
  readonly sha: string;
  readonly findings: readonly GateFinding[];
}

export interface UnchangedPair {
  readonly base: GateFinding;
  readonly head: GateFinding;
}

export interface GateClassification {
  readonly new: readonly GateFinding[];
  readonly fixed: readonly GateFinding[];
  readonly unchanged: readonly UnchangedPair[];
}

export type GateEngineName = 'neo4j' | 'lexical';

export interface GateResult extends GateClassification {
  readonly engine: GateEngineName;
  readonly spec: string;
  /** Project directory relative to the repository root (`.` for the root). */
  readonly project: string;
  readonly base: { readonly ref: string; readonly sha: string; readonly findings: number };
  readonly head: { readonly ref: string; readonly sha: string; readonly findings: number };
  /** Base path -> head path for files git reports renamed; base findings are re-keyed through it before matching. */
  readonly renames: Readonly<Record<string, string>>;
  /** `fail` iff at least one NEW finding is blocking, or a blocking rule failed to execute on head (fail-closed). */
  readonly verdict: 'pass' | 'fail';
  readonly newBlocking: number;
  /** Blocking rules that failed to execute on the head commit (its report verdict `incomplete`); absent when none. */
  readonly headBlockingNotExecuted?: readonly string[];
}
