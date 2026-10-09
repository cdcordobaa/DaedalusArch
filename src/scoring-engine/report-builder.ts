/**
 * Report builder (C8 / S1; FR-13, FR-14, FR-20, FR-33; U3 BR-U3-51..55, 57, 63..65;
 * domain-entities.md §3, §6).
 *
 * `buildEvaluationReport(scored, facts)` turns the scoring stage's `ScoredReport` and the run facts
 * of every earlier stage into the one `EvaluationReport` all consumers read: `functionExecution`
 * with identities I1–I6 (`REPORT_COUNTS_INCONSISTENT`), the failed-function exclusion invariant
 * (BR-U3-53), tag-ordered `functionResults`, `disabledFunctions`, mode-conditional `neuralResults`
 * (`REPORT_NEURAL_ROWS_UNAVAILABLE` until U4's mapper is wired), the run-level fields and the merged
 * warnings. Pure: no I/O. Wired by `AssembleReportCommand` at U3-R9; schema validation (R10) and
 * `scrubDeep` of the whole report (R11) are added there.
 */
import type {
  APGResult,
} from '../shared/types/apg.js';
import type {
  CompiledFunctions, DisabledFunctionRow, EvaluationReport, EvaluationResults, FunctionExecution,
  FunctionFailure, FunctionResultRow, IngestionResult, JudgeProvenance, NeuralResultRow,
  NeuronalFunctionResult, ScoredReport, StageTimings, SymbolicFunctionResult,
} from '../shared/types/evaluation.js';
import type { Dimension, EvaluationMode, Route, TemplateTag } from '../shared/types/enums.js';
import type { FitnessFunction } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import type { PipelineError, PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubWarning } from '../shared/errors/scrub.js';
import { getTemplateTag } from '../fitness-compiler/cypher-templates.js';
import { mergeWarnings, REPORT_STAGE } from './warning-merge.js';
import { INSTRUMENT_VERSION } from '../fitness-compiler/role-exemptions.js';
import type { InstrumentVersion } from '../fitness-compiler/role-exemptions.js';

/** Declared-side counts computed in `CompileCommand` (U3 hunk at R9; BR-U3-52). */
export interface CompileFacts {
  readonly declared: number;
  readonly adrDerived: number;
  readonly dropped: readonly FunctionId[];
  /** Symbolic instrument version the functions were compiled under (ADR-026); default `INSTRUMENT_VERSION`. */
  readonly instrumentVersion?: InstrumentVersion;
}

/** Everything the builder reads besides the scored report (domain-entities.md §6.1). */
export interface RunFacts {
  readonly apg: Pick<APGResult, 'parseCoverage' | 'importResolution'>;
  readonly ingestion: IngestionResult;
  readonly compiled: CompiledFunctions;
  readonly compileFacts: CompileFacts;
  readonly evaluation: EvaluationResults;
  readonly timings: StageTimings;
  readonly pipelineWarnings: readonly PipelineWarning[];
  readonly judge: JudgeProvenance;
  /** U4 `toNeuralResultRows(neuronal output)`; required in full and neuronal-only modes (BR-U3-65). */
  readonly neuralRows?: readonly NeuralResultRow[];
  readonly knownSecrets: readonly string[];
  readonly mode: EvaluationMode;
}

export type ReportBuilderErrorCode = 'REPORT_COUNTS_INCONSISTENT' | 'REPORT_NEURAL_ROWS_UNAVAILABLE';

export interface ReportBuilderError extends PipelineError {
  readonly code: ReportBuilderErrorCode;
  readonly stage: typeof REPORT_STAGE;
  readonly critical: true;
}

/** Frozen reason for a function disabled without a compiler reason (BR-U3-64, BR-U3-70 item 11). */
export const DISABLED_IN_SPEC = 'disabled in spec';

/** Judge provenance of a run without a provider (symbolic-only stub until U4 merges; BR-U3-63). */
export const NO_JUDGE: JudgeProvenance = { provider: 'none', model: 'none', runsPerUnit: 0 };

/** Warning code U4 emits for a neural function with zero selected units (U4 BR-U4-AGG-09). */
export const JUDGE_NO_UNITS = 'JUDGE_NO_UNITS';

const TAG_RANK: Readonly<Record<TemplateTag, number>> = { structural: 0, topological: 1, 'pattern-proxy': 2 };
const NO_TAG_RANK = 3;

interface CompiledEntry {
  readonly functionId: string;
  readonly name: string;
  readonly route: Route;
  readonly adr: boolean;
  /** Template name of the symbolic half (symbolic and hybrid), for the tag. */
  readonly templateName?: string;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Every compiled function once, keyed by id, with its route (hybrid pairs are one function). */
export function compiledEntries(compiled: CompiledFunctions): ReadonlyMap<string, CompiledEntry> {
  const entries = new Map<string, CompiledEntry>();
  for (const q of compiled.symbolicQueries) {
    entries.set(String(q.functionId), { functionId: String(q.functionId), name: q.name, route: 'symbolic', adr: q.source === 'adr', templateName: q.name });
  }
  for (const n of compiled.neuronalInstructions) {
    entries.set(String(n.functionId), { functionId: String(n.functionId), name: n.name, route: 'neuronal', adr: n.source === 'adr' });
  }
  for (const p of compiled.hybridPairs) {
    entries.set(String(p.functionId), {
      functionId: String(p.functionId),
      name: p.symbolicQuery.name,
      route: 'hybrid',
      adr: p.symbolicQuery.source === 'adr' || p.neuronalInstruction.source === 'adr',
      templateName: p.symbolicQuery.name,
    });
  }
  return entries;
}

/**
 * BR-U3-52: `declared` = spec functions in scope (enabled or not); `adrDerived` = compiled functions
 * with source `adr`; `dropped` = declared ids − (compiled ids − ADR ids) − disabled ids, ascending.
 */
export function compileFactsOf(
  fitnessFunctions: readonly FitnessFunction[],
  compiled: CompiledFunctions,
  instrumentVersion: InstrumentVersion = INSTRUMENT_VERSION,
): CompileFacts {
  const entries = [...compiledEntries(compiled).values()];
  const specCompiled = new Set(entries.filter((e) => !e.adr).map((e) => e.functionId));
  const disabled = new Set(compiled.disabledFunctions.map((d) => String(d.id)));
  const dropped = fitnessFunctions
    .map((f) => f.id)
    .filter((id) => !specCompiled.has(String(id)) && !disabled.has(String(id)))
    .sort((a, b) => compare(String(a), String(b)));
  return {
    declared: fitnessFunctions.length,
    adrDerived: entries.filter((e) => e.adr).length,
    dropped: [...new Set(dropped)],
    instrumentVersion,
  };
}

function inconsistent(identity: string, left: unknown, right: unknown, detail: string): ReportBuilderError {
  return {
    code: 'REPORT_COUNTS_INCONSISTENT',
    stage: REPORT_STAGE,
    critical: true,
    message: `${identity} failed: ${detail} (left ${JSON.stringify(left)}, right ${JSON.stringify(right)})`,
    context: { identity, left, right },
  };
}

/** Compiled functions whose route the mode does not run (BR-U3-15, BR-U3-53); never reads `filterByMode`. */
export function skippedByModeOf(compiled: CompiledFunctions, mode: EvaluationMode): number {
  switch (mode) {
    case 'symbolic-only':
      return compiled.neuronalInstructions.length + compiled.hybridPairs.length;
    case 'neuronal-only':
      return compiled.symbolicQueries.length + compiled.hybridPairs.length;
    case 'full':
      return 0;
  }
}

/** `functionExecution.noJudgeUnits` from the `JUDGE_NO_UNITS` warnings; `undefined` if one lacks `context.functionId`. */
function noJudgeUnitsOf(warnings: readonly PipelineWarning[]): readonly FunctionId[] | undefined {
  const ids = new Set<string>();
  for (const w of warnings) {
    if (w.code !== JUDGE_NO_UNITS) continue;
    const id = w.context?.functionId;
    if (typeof id !== 'string' || id.length === 0) return undefined;
    ids.add(id);
  }
  return [...ids].sort(compare) as FunctionId[];
}

function sortFailures(failures: readonly FunctionFailure[]): readonly FunctionFailure[] {
  return [...failures].sort((a, b) => compare(String(a.functionId), String(b.functionId)) || compare(a.code, b.code));
}

interface ExecutedFunction {
  readonly entry: CompiledEntry;
  readonly symbolic?: SymbolicFunctionResult;
  readonly neural?: NeuronalFunctionResult;
}

function rowOf(fn: ExecutedFunction, violationCount: number): FunctionResultRow {
  const { entry, symbolic, neural } = fn;
  const dimension: Dimension | undefined = symbolic?.dimension ?? neural?.dimension;
  const tag = entry.route === 'neuronal'
    ? undefined
    : symbolic?.tag ?? (entry.templateName !== undefined && !entry.adr ? getTemplateTag(entry.templateName) : undefined);
  const neuralPassed = neural?.verdict !== 'fail';
  const passed = (symbolic?.passed ?? true) && neuralPassed;
  return {
    functionId: (symbolic?.functionId ?? neural?.functionId ?? entry.functionId) as FunctionId,
    name: entry.name,
    dimension: dimension ?? 'structural',
    route: entry.route,
    ...(tag !== undefined ? { tag } : {}),
    passed,
    violationCount,
    executionTimeMs: symbolic?.executionTimeMs ?? 0,
    truncated: symbolic?.truncated === true,
  };
}

function rowOrder(a: FunctionResultRow, b: FunctionResultRow): number {
  const rank = (r: FunctionResultRow): number => (r.tag !== undefined ? TAG_RANK[r.tag] : NO_TAG_RANK);
  return rank(a) - rank(b) || compare(String(a.functionId), String(b.functionId));
}

function disabledRows(compiled: CompiledFunctions): readonly DisabledFunctionRow[] {
  return compiled.disabledFunctions
    .map((d) => {
      const reason = d.reason ?? '';
      return { functionId: d.id, name: d.name, reason: reason.length > 0 ? reason : DISABLED_IN_SPEC };
    })
    .sort((a, b) => compare(String(a.functionId), String(b.functionId)));
}

/** Builds and checks the report; fails closed with `REPORT_COUNTS_INCONSISTENT` or `REPORT_NEURAL_ROWS_UNAVAILABLE`. */
export function buildEvaluationReport(scored: ScoredReport, facts: RunFacts): DomainResult<EvaluationReport> {
  const { compiled, compileFacts, evaluation, mode } = facts;
  const entries = compiledEntries(compiled);
  const failed = sortFailures(evaluation.failures ?? []);
  const failedIds = new Set(failed.map((f) => String(f.functionId)));

  const noJudgeUnits = noJudgeUnitsOf(facts.pipelineWarnings);
  if (noJudgeUnits === undefined) {
    return DomainResult.fail([inconsistent('I2', 'JUDGE_NO_UNITS', 'context.functionId', 'a JUDGE_NO_UNITS warning has no context.functionId')]);
  }
  const noUnitIds = new Set(noJudgeUnits.map(String));

  // BR-U3-53 exclusion invariant: results of failed functions never count, whatever the router produced.
  const symbolic = evaluation.symbolicResults.filter((r) => !failedIds.has(String(r.functionId)));
  const neural = evaluation.neuronalResults.filter((r) => !failedIds.has(String(r.functionId)));

  const executedFns = new Map<string, ExecutedFunction>();
  for (const r of symbolic) {
    const entry = entries.get(String(r.functionId));
    if (entry === undefined) {
      return DomainResult.fail([inconsistent('I5', String(r.functionId), 'compiled ids', 'a symbolic result has no compiled function')]);
    }
    executedFns.set(entry.functionId, { ...executedFns.get(entry.functionId), entry, symbolic: r });
  }
  for (const r of neural) {
    const entry = entries.get(String(r.functionId));
    if (entry === undefined) {
      return DomainResult.fail([inconsistent('I5', String(r.functionId), 'compiled ids', 'a neural result has no compiled function')]);
    }
    const prior = executedFns.get(entry.functionId);
    // A hybrid symbolic half with `neuralSkipped` counts no neural result (BR-U3-53).
    if (prior?.symbolic?.neuralSkipped !== undefined) continue;
    executedFns.set(entry.functionId, { ...prior, entry, neural: r });
  }

  const disabledFunctions = disabledRows(compiled);
  const functionExecution: FunctionExecution = {
    declared: compileFacts.declared,
    adrDerived: compileFacts.adrDerived,
    compiled: compiled.totalCompiled,
    disabled: compiled.disabledFunctions.length,
    dropped: [...compileFacts.dropped].sort((a, b) => compare(String(a), String(b))),
    skippedByMode: skippedByModeOf(compiled, mode),
    noJudgeUnits,
    executed: executedFns.size,
    failed,
  };

  const violations = scored.violations.filter((v) => !failedIds.has(String(v.functionId)));
  const violationCounts = new Map<string, number>();
  for (const v of violations) violationCounts.set(String(v.functionId), (violationCounts.get(String(v.functionId)) ?? 0) + 1);
  const functionResults = [...executedFns.values()]
    .map((fn) => rowOf(fn, violationCounts.get(fn.entry.functionId) ?? 0))
    .sort(rowOrder);

  let neuralResults: readonly NeuralResultRow[] | undefined;
  if (mode === 'full' || mode === 'neuronal-only') {
    if (facts.neuralRows === undefined) {
      const unavailable: ReportBuilderError = {
        code: 'REPORT_NEURAL_ROWS_UNAVAILABLE',
        stage: REPORT_STAGE,
        critical: true,
        message: `${mode} mode needs neural result rows (U4 toNeuralResultRows is not wired); no report is written`,
      };
      return DomainResult.fail([unavailable]);
    }
    neuralResults = facts.neuralRows
      .filter((row) => !failedIds.has(String(row.functionId)))
      .sort((a, b) => compare(String(a.functionId), String(b.functionId)));
  }

  const identityError = checkIdentities({
    fe: functionExecution, entries, disabledFunctions, functionResults, executedFns, neuralResults,
    functionCountSum: scored.perDimensionScores.reduce((sum, s) => sum + s.functionCount, 0),
    noUnitIds,
  });
  if (identityError !== undefined) return DomainResult.fail([identityError]);

  const report: EvaluationReport = {
    ...scored,
    violations,
    warnings: mergeWarnings(facts.pipelineWarnings, (w) => scrubWarning(w, facts.knownSecrets)),
    functionExecution,
    functionResults,
    disabledFunctions,
    graphStats: facts.ingestion.graphStats,
    layerAnnotation: facts.ingestion.layerAnnotationSummary,
    parseCoverage: facts.apg.parseCoverage,
    importResolution: facts.apg.importResolution,
    timings: facts.timings,
    judge: facts.judge,
    instrumentVersion: facts.compileFacts.instrumentVersion ?? INSTRUMENT_VERSION,
    ...(neuralResults !== undefined ? { neuralResults } : {}),
  };
  return DomainResult.ok(report);
}

interface IdentityInput {
  readonly fe: FunctionExecution;
  readonly entries: ReadonlyMap<string, CompiledEntry>;
  readonly disabledFunctions: readonly DisabledFunctionRow[];
  readonly functionResults: readonly FunctionResultRow[];
  readonly executedFns: ReadonlyMap<string, ExecutedFunction>;
  readonly neuralResults: readonly NeuralResultRow[] | undefined;
  readonly functionCountSum: number;
  readonly noUnitIds: ReadonlySet<string>;
}

/** Identities I1–I6 of domain-entities.md §3.2; the first failing one is returned. */
function checkIdentities(x: IdentityInput): ReportBuilderError | undefined {
  const { fe } = x;
  const i1Left = fe.declared + fe.adrDerived;
  const i1Right = fe.compiled + fe.disabled + fe.dropped.length;
  if (i1Left !== i1Right) return inconsistent('I1', i1Left, i1Right, 'declared + adrDerived = compiled + disabled + dropped.length');

  const i2Right = fe.executed + fe.failed.length + fe.skippedByMode + fe.noJudgeUnits.length;
  if (fe.compiled !== i2Right) return inconsistent('I2', fe.compiled, i2Right, 'compiled = executed + failed.length + skippedByMode + noJudgeUnits.length');

  // I3: `dropped` is a set disjoint from the compiled and disabled ids (the declared-id set difference
  // itself is computed by compileFactsOf); `disabledFunctions` holds exactly `disabled` distinct ids.
  const disabledIds = new Set(x.disabledFunctions.map((d) => String(d.functionId)));
  if (disabledIds.size !== fe.disabled) return inconsistent('I3', disabledIds.size, fe.disabled, 'distinct disabledFunctions ids = disabled');
  const droppedIds = new Set(fe.dropped.map(String));
  const droppedClash = [...droppedIds].filter((id) => x.entries.has(id) || disabledIds.has(id));
  if (droppedIds.size !== fe.dropped.length || droppedClash.length > 0) {
    return inconsistent('I3', fe.dropped, droppedClash, 'dropped ids are distinct and neither compiled nor disabled');
  }

  if (x.functionCountSum !== fe.executed) return inconsistent('I4', x.functionCountSum, fe.executed, 'sum of perDimensionScores functionCount = executed');

  const rowIds = new Set(x.functionResults.map((r) => String(r.functionId)));
  if (rowIds.size !== fe.executed || x.functionResults.length !== fe.executed) {
    return inconsistent('I5', x.functionResults.length, fe.executed, 'functionResults has exactly executed distinct ids');
  }
  const failedIds = new Set(fe.failed.map((f) => String(f.functionId)));
  const i5Clash = [...rowIds].filter((id) => failedIds.has(id) || x.noUnitIds.has(id) || disabledIds.has(id));
  if (i5Clash.length > 0) return inconsistent('I5', i5Clash, [], 'functionResults ids are disjoint from failed, noJudgeUnits and disabled ids');

  if (x.neuralResults !== undefined) {
    const rowsById = new Map(x.functionResults.map((r) => [String(r.functionId), r]));
    const neuralCount = new Map<string, number>();
    for (const n of x.neuralResults) neuralCount.set(String(n.functionId), (neuralCount.get(String(n.functionId)) ?? 0) + 1);
    for (const [id, count] of neuralCount) {
      const row = rowsById.get(id);
      if (row === undefined || row.route === 'symbolic' || count !== 1) {
        return inconsistent('I6', id, row?.route ?? 'no row', 'each neuralResults row has one neuronal or hybrid functionResults row');
      }
    }
    for (const row of x.functionResults) {
      const id = String(row.functionId);
      const expected = row.route === 'neuronal' || (row.route === 'hybrid' && x.executedFns.get(id)?.neural !== undefined) ? 1 : 0;
      const actual = neuralCount.get(id) ?? 0;
      if (row.route !== 'symbolic' && actual !== expected) {
        return inconsistent('I6', actual, expected, `neuralResults rows for ${row.route} function ${id}`);
      }
    }
  }
  return undefined;
}
