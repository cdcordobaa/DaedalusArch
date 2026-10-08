import type { FunctionFailure, InvalidCause, NeuronalInstruction } from '../shared/types/evaluation.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import { AGGREGATION_RULE, MIN_VALID_RUNS_PER_UNIT, UNSTABLE_THRESHOLD } from './frozen.js';
import type { CallOutcome, CriticVerdict, CriticViolation } from './types.js';
import { filterMembers } from './verdict-parser.js';

/**
 * Unit vote, function aggregation and violation forming (BR-U4-AGG-01..09, VIO-01..04,
 * VRD-04, VRD-06; BLM §8, §9). Pure: no I/O; the violation id function is a parameter
 * (wired to U3's `computeViolationId` at Step 21, D-U4-6).
 */

/** One run of one unit with its final outcome; `verdict` is the stored (scrubbed) verdict of a valid run. */
export interface UnitRun {
  readonly runIndex: number;
  readonly outcome: CallOutcome;
  readonly verdict: CriticVerdict | null;
}

/** Order of `InvalidCause` (DE §4.2), used for counts and ties. */
export const INVALID_CAUSES: readonly InvalidCause[] = Object.freeze([
  'PARSE_FAILURE', 'MISSING_CONFIDENCE', 'MODEL_MISMATCH', 'TIMEOUT', 'BAD_ENVELOPE', 'CLI_EXIT',
]);

export type InvalidCounts = Readonly<Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number>>;

export function emptyInvalidCounts(): Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number> {
  return {
    PARSE_FAILURE: 0, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 0, BAD_ENVELOPE: 0, CLI_EXIT: 0,
    INSUFFICIENT_VALID_RUNS: 0,
  };
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation (BR-U4-AGG-01). */
export function populationStdDev(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / xs.length);
}

function validRuns(runs: readonly UnitRun[]): { readonly runIndex: number; readonly verdict: CriticVerdict }[] {
  const out: { runIndex: number; verdict: CriticVerdict }[] = [];
  for (const run of [...runs].sort((a, b) => a.runIndex - b.runIndex)) {
    if (run.outcome.kind === 'valid' && run.verdict !== null) out.push({ runIndex: run.runIndex, verdict: run.verdict });
  }
  return out;
}

// ── Unit vote (AGG-01) ───────────────────────────────────────────────────────────────────

export interface UnitVote {
  readonly status: 'valid' | 'invalid';
  readonly verdict: 'pass' | 'fail' | 'warning';     // 'warning' for an invalid unit, never counted
  readonly confidence: number;                        // 0 for an invalid unit
  readonly confidenceStdDev: number;                  // over valid runs
  readonly flaggedUnstable: boolean;
  readonly validRunCount: number;
  readonly invalidRunCauses: readonly InvalidCause[]; // in run order
}

/**
 * Majority over valid runs; a 1-1 split of 2 valid runs → `warning`; fewer than 2 valid runs →
 * invalid. Confidence = mean of the runs voting with the verdict (warning: all valid runs).
 * Unstable ⇔ population stddev over valid runs > `unstableThreshold`.
 */
export function voteUnit(runs: readonly UnitRun[], unstableThreshold: number = UNSTABLE_THRESHOLD): UnitVote {
  const valid = validRuns(runs);
  const invalidRunCauses = [...runs]
    .sort((a, b) => a.runIndex - b.runIndex)
    .flatMap((r) => (r.outcome.kind === 'invalid' ? [r.outcome.cause] : []));
  const confidences = valid.map((r) => r.verdict.confidence);
  const stddev = populationStdDev(confidences);
  const flaggedUnstable = stddev > unstableThreshold;
  if (valid.length < MIN_VALID_RUNS_PER_UNIT) {
    return {
      status: 'invalid', verdict: 'warning', confidence: 0, confidenceStdDev: stddev, flaggedUnstable,
      validRunCount: valid.length, invalidRunCauses,
    };
  }
  const fails = valid.filter((r) => !r.verdict.pass);
  const passes = valid.filter((r) => r.verdict.pass);
  let verdict: UnitVote['verdict'];
  let carriers: readonly { verdict: CriticVerdict }[];
  if (fails.length * 2 > valid.length) {
    verdict = 'fail';
    carriers = fails;
  } else if (passes.length * 2 > valid.length) {
    verdict = 'pass';
    carriers = passes;
  } else {
    verdict = 'warning';
    carriers = valid;
  }
  return {
    status: 'valid', verdict, confidence: mean(carriers.map((r) => r.verdict.confidence)), confidenceStdDev: stddev,
    flaggedUnstable, validRunCount: valid.length, invalidRunCauses,
  };
}

/**
 * Dominant cause of an invalid unit's invalid runs (ties: `INVALID_CAUSES` order);
 * `INSUFFICIENT_VALID_RUNS` when it has no invalid run at all (DE §4.2).
 */
export function dominantInvalidCause(causes: readonly InvalidCause[]): InvalidCause | 'INSUFFICIENT_VALID_RUNS' {
  let best: InvalidCause | 'INSUFFICIENT_VALID_RUNS' = 'INSUFFICIENT_VALID_RUNS';
  let bestCount = 0;
  for (const cause of INVALID_CAUSES) {
    const count = causes.filter((c) => c === cause).length;
    if (count > bestCount) {
      best = cause;
      bestCount = count;
    }
  }
  return best;
}

/** `unitsInvalidByCause` of one function (AGG-02): invalid units counted under their dominant cause. */
export function countInvalidByCause(units: readonly Pick<UnitVote, 'status' | 'invalidRunCauses'>[]): InvalidCounts {
  const counts = emptyInvalidCounts();
  for (const unit of units) {
    if (unit.status === 'invalid') counts[dominantInvalidCause(unit.invalidRunCauses)]++;
  }
  return counts;
}

// ── Function aggregation (AGG-04, AGG-05, AGG-09) ────────────────────────────────────────

export type FunctionAggregation =
  | {
    readonly kind: 'result';
    readonly verdict: 'pass' | 'fail' | 'warning';
    readonly confidence: number;
    readonly confidenceStdDev: number;
    readonly flaggedUnstable: boolean;
    readonly aggregationRule: typeof AGGREGATION_RULE;
  }
  | { readonly kind: 'failure'; readonly validUnits: number; readonly selectedUnits: number; readonly unitsInvalidByCause: InvalidCounts }
  | { readonly kind: 'no-units' };

type VotedUnit = Pick<UnitVote, 'status' | 'verdict' | 'confidence' | 'flaggedUnstable' | 'invalidRunCauses'>;

/**
 * `majority-of-valid-units-v1`: fail when strictly more than half of the valid units fail;
 * else warning when any valid unit fails or is a warning; else pass. Confidence and
 * instability come only from the carrying units. Fewer than half the selected units valid
 * (`2·valid < selected`) → function failure; zero selected units → no result (AGG-09).
 */
export function aggregateUnitVerdicts(units: readonly VotedUnit[]): FunctionAggregation {
  const selected = units.length;
  const valid = units.filter((u) => u.status === 'valid');
  if (valid.length * 2 < selected) {
    return { kind: 'failure', validUnits: valid.length, selectedUnits: selected, unitsInvalidByCause: countInvalidByCause(units) };
  }
  if (selected === 0) return { kind: 'no-units' };
  const failing = valid.filter((u) => u.verdict === 'fail');
  let verdict: 'pass' | 'fail' | 'warning';
  let carriers: readonly VotedUnit[];
  if (failing.length * 2 > valid.length) {
    verdict = 'fail';
    carriers = failing;
  } else if (failing.length > 0 || valid.some((u) => u.verdict === 'warning')) {
    verdict = 'warning';
    carriers = valid;
  } else {
    verdict = 'pass';
    carriers = valid.filter((u) => u.verdict === 'pass');
  }
  const confidences = carriers.map((u) => u.confidence);
  return {
    kind: 'result',
    verdict,
    confidence: mean(confidences),
    confidenceStdDev: populationStdDev(confidences),
    flaggedUnstable: carriers.filter((u) => u.flaggedUnstable).length * 2 > carriers.length,
    aggregationRule: AGGREGATION_RULE,
  };
}

/** AGG-05: the `FunctionFailure` for a failed aggregation; the message is scrubbed. */
export function functionFailureOf(
  instruction: Pick<NeuronalInstruction, 'functionId' | 'name'>,
  failure: Extract<FunctionAggregation, { kind: 'failure' }>,
  knownSecrets: readonly string[] = [],
): FunctionFailure {
  const causes = Object.entries(failure.unitsInvalidByCause)
    .filter(([, n]) => n > 0)
    .map(([cause, n]) => `${cause}: ${String(n)}`)
    .join(', ');
  return {
    functionId: instruction.functionId,
    name: instruction.name,
    code: 'INSUFFICIENT_VALID_RUNS',
    message: scrubSecrets(
      `${String(failure.validUnits)} of ${String(failure.selectedUnits)} selected units valid for ${instruction.name}`
      + ` (invalid units by cause: ${causes === '' ? 'none' : causes})`,
      knownSecrets,
    ),
  };
}

// ── Violations (VIO-01..04, VRD-04, VRD-06) ──────────────────────────────────────────────

/** VIO-03: ADR-derived → INTENT_VIOLATION; Integrity → INTEGRITY_VIOLATION; else SEMANTIC_RULE_VIOLATION. */
export function violationTypeOf(instruction: Pick<NeuronalInstruction, 'source' | 'dimension'>): ViolationType {
  if (instruction.source === 'adr') return 'INTENT_VIOLATION';
  if (instruction.dimension === 'integrity') return 'INTEGRITY_VIOLATION';
  return 'SEMANTIC_RULE_VIOLATION';
}

/** Id function shape of U3's `computeViolationId` (FR-12, BR-U4-VIO-02). */
export type ViolationIdFn = (input: {
  readonly functionId: string;
  readonly filePath: string;
  readonly discriminator: readonly string[];
}) => string;

export interface UnitViolations {
  readonly violations: readonly Violation[];   // sorted by filePath
  readonly inconsistentRuns: number;           // VRD-04: valid pass=true runs that listed violations
  readonly droppedPaths: number;               // VRD-05/06: paths dropped from valid pass=false runs
}

/**
 * VIO-01: one violation per normalised, member-validated `filePath` cited by strictly more than
 * half of the unit's valid runs, counting only `pass = false` runs; only for a failing unit.
 * Message from the citing run with the highest confidence (tie: lowest runIndex). The id
 * ignores the message (VIO-02).
 */
export function formUnitViolations(
  unit: { readonly id: string; readonly filePaths: readonly string[] },
  runs: readonly UnitRun[],
  vote: Pick<UnitVote, 'status' | 'verdict'>,
  instruction: Pick<NeuronalInstruction, 'functionId' | 'dimension' | 'severity' | 'source'>,
  projectRoot: string,
  idFn: ViolationIdFn,
): UnitViolations {
  const valid = validRuns(runs);
  const inconsistentRuns = valid.filter((r) => r.verdict.pass && r.verdict.violations.length > 0).length;
  const failRuns = valid.filter((r) => !r.verdict.pass);
  let droppedPaths = 0;
  const cited = new Map<string, { runIndex: number; confidence: number; message: string }[]>();
  for (const run of failRuns) {
    const members = filterMembers<CriticViolation>(run.verdict.violations, unit, projectRoot);
    droppedPaths += members.droppedOutside + members.droppedNonMember;
    const seenInRun = new Set<string>();
    for (const v of members.kept) {
      if (seenInRun.has(v.filePath)) continue;
      seenInRun.add(v.filePath);
      const list = cited.get(v.filePath) ?? [];
      list.push({ runIndex: run.runIndex, confidence: run.verdict.confidence, message: v.message });
      cited.set(v.filePath, list);
    }
  }
  const violations: Violation[] = [];
  if (vote.status === 'valid' && vote.verdict === 'fail') {
    for (const filePath of [...cited.keys()].sort()) {
      const citations = cited.get(filePath) ?? [];
      if (citations.length * 2 <= valid.length) continue;
      const best = [...citations].sort((a, b) => b.confidence - a.confidence || a.runIndex - b.runIndex)[0];
      if (best === undefined) continue;
      violations.push({
        id: idFn({ functionId: String(instruction.functionId), filePath, discriminator: [unit.id] }),
        type: violationTypeOf(instruction),
        dimension: instruction.dimension,
        severity: instruction.severity,
        functionId: instruction.functionId,
        route: 'neuronal',
        filePath,
        message: best.message,
        deterministic: false,
      });
    }
  }
  return { violations, inconsistentRuns, droppedPaths };
}

/** VIO-04: function violations = failing units in `unitId` order, then `filePath` order. */
export function listFunctionViolations(units: readonly { readonly unitId: string; readonly violations: readonly Violation[] }[]): Violation[] {
  return [...units]
    .sort((a, b) => (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0))
    .flatMap((u) => [...u.violations].sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0)));
}

/**
 * Per-function warnings: one `VERDICT_INCONSISTENT` (VRD-04) and one `VIOLATION_PATH_DROPPED`
 * (VRD-06) with the count in the message, and one `INSUFFICIENT_VALID_RUNS` per invalid unit
 * naming all its causes (AGG-01).
 */
export function aggregationWarnings(
  functionId: string,
  totals: { readonly inconsistentRuns: number; readonly droppedPaths: number },
  invalidUnits: readonly { readonly unitId: string; readonly invalidRunCauses: readonly InvalidCause[]; readonly validRunCount: number }[],
): PipelineWarning[] {
  const warnings: PipelineWarning[] = [];
  if (totals.inconsistentRuns > 0) {
    warnings.push({
      code: 'VERDICT_INCONSISTENT', stage: 'llm-critic', context: { functionId, count: totals.inconsistentRuns },
      message: `${functionId}: ${String(totals.inconsistentRuns)} passing run(s) listed violations; ignored`,
    });
  }
  if (totals.droppedPaths > 0) {
    warnings.push({
      code: 'VIOLATION_PATH_DROPPED', stage: 'llm-critic', context: { functionId, count: totals.droppedPaths },
      message: `${functionId}: ${String(totals.droppedPaths)} violation path(s) outside the unit dropped`,
    });
  }
  for (const unit of invalidUnits) {
    const causes = unit.invalidRunCauses.length === 0 ? 'none' : unit.invalidRunCauses.join(', ');
    warnings.push({
      code: 'INSUFFICIENT_VALID_RUNS', stage: 'llm-critic', context: { functionId, unitId: unit.unitId },
      message: `${functionId}: unit ${unit.unitId} has ${String(unit.validRunCount)} valid run(s) (invalid causes: ${causes})`,
    });
  }
  return warnings;
}
