import type {
  FunctionFailure, JudgeUnitResult, NeuronalFunctionResult, NeuronalInstruction, NeuronalRun,
} from '../shared/types/evaluation.js';
import type { LLMOptions } from '../shared/interfaces/llm-provider.js';
import type { PipelineWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import { confidence as makeConfidence } from '../shared/types/value-objects.js';
import { computeViolationId } from '../evaluation-engine/violation-id.js';
import type { CriticVerdict, NeuronalEvalInput, NeuronalRunOptions, RunCompleteness, RunManifest, StopCause } from './types.js';
import { DEFAULT_NEURONAL_RUN_OPTIONS } from './types.js';
import { assembleContext, constructPrompt } from './context-assembler.js';
import { assembleUnitSourceFromView } from './source-context.js';
import type { UnitSourceContext } from './source-context.js';
import type { JudgeGraphView } from './judge-graph.js';
import { loadJudgeGraphView } from './judge-graph.js';
import type { CandidateSet, SelectedUnit, UnitSelection } from './judge-unit-selector.js';
import { buildCandidateSet, resolveBaselineSelection, selectUnits } from './judge-unit-selector.js';
import type { UnitRun, UnitVote } from './aggregation.js';
import {
  aggregateUnitVerdicts, aggregationWarnings, countInvalidByCause, formUnitViolations, functionFailureOf,
  listFunctionViolations, voteUnit,
} from './aggregation.js';
import type { JudgeCallResult } from './cassette-provider.js';
import { CassetteLLMProvider, knownSecretsFrom } from './cassette-provider.js';

/**
 * C7 LLM critic (U4 plan Step 21, U4-K4; BLM §2, §5, §7.2, §8, §9; BR-U4-CTX-01, SEL-05,
 * AGG-03..09, VIO-02, VRD-04, OPS-01, OPS-03).
 *
 * Per neuronal instruction, in `functionId` order: candidates → units → selection → unit source
 * and prompt → one request per `runIndex`, each carrying its `LLMCallContext`. All calls of the
 * run share one pool of `maxConcurrency`, issued in (functionId, unitId, runIndex) order; results
 * are stored by call index and assembled in that order, never in completion order. A stop cause
 * halts new calls, lets in-flight calls finish and leaves the run `incomplete` (no results, a
 * `RunManifest` for the pipeline to write, exit 3). A complete run votes each unit, forms the
 * unit violations with U3's `computeViolationId` (discriminator `[unitId]`), and aggregates each
 * function into a `NeuronalFunctionResult` or a `FunctionFailure`.
 *
 * `icc` stays `0` (reliability is computed by U5b from the cassettes) and the function-level
 * `runs` is `[]`: runs live per unit (DE §4.4).
 */

export interface NeuronalEvalOutput {
  readonly results: readonly NeuronalFunctionResult[];
  readonly warnings: readonly PipelineWarning[];
  /** Neural function failures (`INSUFFICIENT_VALID_RUNS`, `CRITIC_001`); `[]` when none (FR-13). */
  readonly failures: readonly FunctionFailure[];
  readonly completeness: RunCompleteness;
  /** Present only for an incomplete run; the command writes it (BR-U4-AGG-03). */
  readonly manifest?: RunManifest;
}

const STAGE = 'llm-critic';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Resolved options: `options` over the pre-Step-21 shorthands over the frozen defaults. */
export function resolveRunOptions(input: NeuronalEvalInput): NeuronalRunOptions {
  const d = DEFAULT_NEURONAL_RUN_OPTIONS;
  const o = input.options ?? {};
  return {
    ...d,
    runsPerEvaluation: input.runsPerEvaluation ?? d.runsPerEvaluation,
    maxConcurrency: input.maxConcurrency ?? d.maxConcurrency,
    unstableThreshold: input.unstableThreshold ?? d.unstableThreshold,
    cassette: { ...d.cassette, mode: input.vcrMode ?? d.cassette.mode, dir: input.cassettePath ?? d.cassette.dir },
    ...o,
  };
}

/** One planned judge call. */
interface PlannedCall {
  readonly fn: number;            // index into the planned functions
  readonly unitIndex: number;     // index into that function's units
  readonly functionId: string;
  readonly unit: SelectedUnit;
  readonly runIndex: number;
  readonly prompt: string;
}

/** One function after selection and context assembly, before any call. */
interface PlannedFunction {
  readonly instruction: NeuronalInstruction;
  readonly candidates: CandidateSet;
  readonly selection: UnitSelection;
  readonly contexts: readonly UnitSourceContext[];   // one per selected unit, same order
}

/**
 * Evaluate every neuronal instruction (BLM §2.1 step 5). Fails only on a configuration error
 * (`LLM_BASELINE_SELECTION_MISSING`, SEL-07); every other problem is a function failure, a
 * warning, or an incomplete run.
 */
export async function evaluateNeuronal(input: NeuronalEvalInput): Promise<DomainResult<NeuronalEvalOutput>> {
  const opts = resolveRunOptions(input);
  const projectRoot = input.projectRoot ?? process.cwd();
  const secrets = input.knownSecrets ?? knownSecretsFrom(process.env);
  const warnings: PipelineWarning[] = [];
  const failures: FunctionFailure[] = [];

  // Every real provider is wrapped exactly once (U4 Step 20): a provider built by
  // `createJudgeProvider` is already the decorator and is used as is.
  const cassette = input.provider instanceof CassetteLLMProvider
    ? input.provider
    : new CassetteLLMProvider(input.provider, {
      mode: opts.cassette.mode, dir: opts.cassette.dir, omitPrompt: opts.cassette.omitPrompt, knownSecrets: secrets,
    });

  const instructions = [...input.instructions].sort((a, b) => compareStrings(String(a.functionId), String(b.functionId)));
  if (instructions.length === 0) {
    return DomainResult.ok({ results: [], warnings, failures, completeness: { status: 'complete' } });
  }

  // Graph view (Step 21 reader); a read failure is every function's CRITIC_001 failure (DE §4.5).
  let view: JudgeGraphView;
  if (input.graphView !== undefined) {
    view = input.graphView;
  } else {
    const loaded = await loadJudgeGraphView(input.graphRepository);
    if (!loaded.success) {
      const message = loaded.errors[0]?.message ?? 'graph view could not be read';
      for (const instruction of instructions) {
        failures.push(criticFailure(instruction, message, secrets));
      }
      return DomainResult.ok({ results: [], warnings, failures, completeness: { status: 'complete' } });
    }
    view = loaded.data;
  }

  // 1. Plan: candidates, units, selection, unit source and prompts (no call yet).
  const planned: PlannedFunction[] = [];
  const calls: PlannedCall[] = [];
  for (const instruction of instructions) {
    const functionId = String(instruction.functionId);
    const baseline = resolveBaselineSelection(instruction.functionId, opts.baseline);
    if (!baseline.success) return DomainResult.fail(baseline.errors);

    const candidates = buildCandidateSet(
      view,
      { judgeUnit: instruction.judgeUnit, excludePaths: input.excludePaths?.[functionId] ?? [] },
      projectRoot,
      opts.evaluatorSpecLayers,
    );
    const selection = selectUnits(candidates.units, {
      cap: opts.unitCap,
      seed: opts.selectionSeed,
      minSizeTokens: opts.minSizeTokens,
      seededList: opts.seededList,
      ...(baseline.data !== undefined ? { baseline: baseline.data } : {}),
    }, instruction.functionId);

    if (selection.units.length === 0) {
      // AGG-09: no result, no failure, one warning carrying the function id (BR-U3-51).
      warnings.push({
        code: 'JUDGE_NO_UNITS',
        stage: STAGE,
        context: { functionId },
        message: `${functionId}: no judge unit selected (${String(candidates.units.length)} candidate units, `
          + `${String(candidates.uncoveredFiles.length)} unlayered files)`,
      });
      continue;
    }

    const fnIndex = planned.length;
    const contexts: UnitSourceContext[] = [];
    const fnCalls: PlannedCall[] = [];
    let contextError: string | undefined;
    for (const [unitIndex, unit] of selection.units.entries()) {
      const ctx = assembleUnitSourceFromView(unit, projectRoot, view, opts.tokenBudget, opts.maxNodes);
      if (!ctx.success) {
        contextError = `${unit.id}: ${ctx.errors[0]?.message ?? 'context assembly failed'}`;
        break;
      }
      contexts.push(ctx.data);
      const packet = assembleContext(
        instruction,
        { unit, context: ctx.data, evaluatorSpecLayers: opts.evaluatorSpecLayers },
        input.adrProse?.[functionId],
        opts.tokenBudget,
      );
      const prompt = constructPrompt(packet);
      for (let runIndex = 0; runIndex < opts.runsPerEvaluation; runIndex++) {
        fnCalls.push({ fn: fnIndex, unitIndex, functionId, unit, runIndex, prompt });
      }
    }
    if (contextError !== undefined) {
      failures.push(criticFailure(instruction, contextError, secrets));
      continue;
    }
    planned.push({ instruction, candidates, selection, contexts });
    calls.push(...fnCalls);
  }

  // 2. Judge: one pool, issued in (functionId, unitId, runIndex) order (OPS-03, BLM §7.2).
  const outcomes = await runPool(calls, cassette, opts);
  for (const result of outcomes.results) {
    if (result?.kind !== 'final') continue;
    for (const w of result.warnings) warnings.push({ ...w, stage: STAGE });
  }

  // 3. Completeness (AGG-03): a stop leaves the run incomplete; no unit is marked invalid by it.
  if (outcomes.stop !== undefined) {
    const outstanding = calls.flatMap((call, i) => {
      if (outcomes.results[i]?.kind === 'final') return [];
      const keyed = cassette.keyOf(call.prompt, opts.llm, callContext(call, opts));
      return [{ functionId: call.functionId, unitId: call.unit.id, runIndex: call.runIndex, key: keyed?.key ?? '' }];
    });
    const completedCalls = calls.length - outstanding.length;
    const manifest: RunManifest = {
      projectRoot: scrubSecrets(projectRoot, secrets),
      stop: outcomes.stop.stop,
      message: scrubSecrets(outcomes.stop.message, secrets),
      completedCalls,
      outstanding,
    };
    warnings.push({
      code: 'JUDGE_RUN_INCOMPLETE',
      stage: STAGE,
      context: { stop: outcomes.stop.stop, outstanding: outstanding.length },
      message: `Judge run stopped (${outcomes.stop.stop}): ${String(outstanding.length)} call(s) outstanding; `
        + `resume in record mode. ${manifest.message}`,
    });
    return DomainResult.ok({
      results: [],
      warnings,
      failures,
      completeness: { status: 'incomplete', stop: outcomes.stop.stop, outstanding: outstanding.length },
      manifest,
    });
  }

  // 4. Aggregate (AGG-01..09, VIO-01..04, VRD-04, VRD-06).
  const results: NeuronalFunctionResult[] = [];
  const runsByFunction: UnitRun[][][] = planned.map((fn) => fn.selection.units.map(() => []));
  calls.forEach((call, i) => {
    const r = outcomes.results[i];
    if (r?.kind === 'final') runsByFunction[call.fn]?.[call.unitIndex]?.push({ runIndex: call.runIndex, outcome: r.outcome, verdict: r.verdict });
  });
  for (const [fnIndex, fn] of planned.entries()) {
    const unitRuns = runsByFunction[fnIndex] ?? [];
    const aggregated = aggregateFunction(fn, unitRuns, projectRoot, opts, secrets);
    warnings.push(...aggregated.warnings);
    if (aggregated.kind === 'result') results.push(aggregated.result);
    else failures.push(aggregated.failure);
  }

  return DomainResult.ok({ results, warnings, failures, completeness: { status: 'complete' } });
}

function criticFailure(instruction: NeuronalInstruction, message: string, secrets: readonly string[]): FunctionFailure {
  return {
    functionId: instruction.functionId,
    name: instruction.name,
    code: 'CRITIC_001',
    message: scrubSecrets(`${instruction.name}: ${message}`, secrets),
  };
}

function callContext(
  call: PlannedCall,
  opts: NeuronalRunOptions,
): { runIndex: number; repetition: number; functionId: string; unitId: string } {
  return { runIndex: call.runIndex, repetition: opts.repetition, functionId: call.functionId, unitId: call.unit.id };
}

interface PoolOutcome {
  readonly results: readonly (JudgeCallResult | undefined)[];
  /** The stop of the lowest call index that stopped, if any. */
  readonly stop?: { readonly stop: StopCause; readonly message: string };
}

/**
 * One pool of `maxConcurrency` workers over all calls, issued strictly in call order. After the
 * first stop no new call is issued; in-flight calls complete and keep their final outcomes.
 */
async function runPool(
  calls: readonly PlannedCall[],
  cassette: CassetteLLMProvider,
  opts: NeuronalRunOptions,
): Promise<PoolOutcome> {
  const results: (JudgeCallResult | undefined)[] = new Array<JudgeCallResult | undefined>(calls.length).fill(undefined);
  let next = 0;
  let stopped = false;
  const options: LLMOptions = opts.llm;

  const worker = async (): Promise<void> => {
    while (!stopped && next < calls.length) {
      const index = next++;
      const call = calls[index];
      if (call === undefined) break;
      const result = await cassette.judge(call.prompt, options, callContext(call, opts), call.unit.filePaths);
      results[index] = result;
      if (result.kind === 'stop') stopped = true;
    }
  };
  const width = Math.max(1, Math.min(opts.maxConcurrency, calls.length));
  await Promise.all(Array.from({ length: width }, () => worker()));

  const firstStop = results.find((r): r is Extract<JudgeCallResult, { kind: 'stop' }> => r?.kind === 'stop');
  return firstStop !== undefined
    ? { results, stop: { stop: firstStop.stop, message: firstStop.message } }
    : { results };
}

type FunctionOutcome =
  | { readonly kind: 'result'; readonly result: NeuronalFunctionResult; readonly warnings: readonly PipelineWarning[] }
  | { readonly kind: 'failure'; readonly failure: FunctionFailure; readonly warnings: readonly PipelineWarning[] };

function neuronalRunsOf(runs: readonly UnitRun[]): NeuronalRun[] {
  return [...runs]
    .sort((a, b) => a.runIndex - b.runIndex)
    .flatMap((r) => (r.outcome.kind === 'valid' && r.verdict !== null
      ? [{ runIndex: r.runIndex, verdict: r.verdict.pass ? 'pass' as const : 'fail' as const, confidence: makeConfidence(r.verdict.confidence), reasoning: r.verdict.reasoning }]
      : []));
}

function aggregateFunction(
  fn: PlannedFunction,
  unitRuns: readonly (readonly UnitRun[])[],
  projectRoot: string,
  opts: NeuronalRunOptions,
  secrets: readonly string[],
): FunctionOutcome {
  const { instruction, selection, candidates, contexts } = fn;
  const functionId = String(instruction.functionId);
  const votes: UnitVote[] = [];
  const unitResults: JudgeUnitResult[] = [];
  let inconsistentRuns = 0;
  let droppedPaths = 0;

  selection.units.forEach((unit, i) => {
    const runs = unitRuns[i] ?? [];
    const vote = voteUnit(runs, opts.unstableThreshold);
    votes.push(vote);
    const formed = formUnitViolations(unit, runs, vote, instruction, projectRoot, computeViolationId);
    inconsistentRuns += formed.inconsistentRuns;
    droppedPaths += formed.droppedPaths;
    unitResults.push({
      unitId: unit.id,
      unitKind: unit.kind,
      layer: unit.layer,
      filePaths: unit.filePaths,
      status: vote.status,
      verdict: vote.verdict,
      confidence: makeConfidence(vote.confidence),
      confidenceStdDev: vote.confidenceStdDev,
      flaggedUnstable: vote.flaggedUnstable,
      validRunCount: vote.validRunCount,
      invalidRunCauses: vote.invalidRunCauses,
      truncated: contexts[i]?.truncated ?? false,
      ...(unit.origin !== undefined ? { origin: unit.origin } : {}),
      runs: neuronalRunsOf(runs),
      violations: formed.violations,
    });
  });

  const warnings: PipelineWarning[] = aggregationWarnings(
    functionId,
    { inconsistentRuns, droppedPaths },
    unitResults.filter((u) => u.status === 'invalid').map((u) => ({
      unitId: u.unitId, invalidRunCauses: u.invalidRunCauses ?? [], validRunCount: u.validRunCount ?? 0,
    })),
  );

  const aggregation = aggregateUnitVerdicts(votes);
  if (aggregation.kind === 'failure') {
    return { kind: 'failure', failure: functionFailureOf(instruction, aggregation, secrets), warnings };
  }
  if (aggregation.kind === 'no-units') {
    // Unreachable: a function with no selected unit never reaches aggregation (handled in planning).
    return { kind: 'failure', failure: criticFailure(instruction, 'no units to aggregate', secrets), warnings };
  }

  // Carriers of the verdict (AGG-04): fail → failing units; pass → passing units; warning → valid units.
  const carriers = unitResults.filter((u) => u.status === 'valid' && (
    aggregation.verdict === 'warning' || u.verdict === aggregation.verdict));
  const carrierVerdicts: { unitId: string; runIndex: number; verdict: CriticVerdict }[] = [];
  selection.units.forEach((unit, i) => {
    if (!carriers.some((c) => c.unitId === unit.id)) return;
    for (const run of [...(unitRuns[i] ?? [])].sort((a, b) => a.runIndex - b.runIndex)) {
      if (run.outcome.kind === 'valid' && run.verdict !== null) carrierVerdicts.push({ unitId: unit.id, runIndex: run.runIndex, verdict: run.verdict });
    }
  });
  const best = [...carrierVerdicts].sort((a, b) =>
    b.verdict.confidence - a.verdict.confidence || compareStrings(a.unitId, b.unitId) || a.runIndex - b.runIndex)[0];
  const evidence = [...new Set(carrierVerdicts.flatMap((c) => c.verdict.evidence))];

  const selectedModules = selection.units.filter((u) => u.kind === 'module');
  const result: NeuronalFunctionResult = {
    functionId: instruction.functionId,
    dimension: instruction.dimension,
    verdict: aggregation.verdict,
    confidence: makeConfidence(aggregation.confidence),
    confidenceStdDev: aggregation.confidenceStdDev,
    icc: 0,
    reasoning: best?.verdict.reasoning ?? '',
    evidence,
    violations: listFunctionViolations(unitResults),
    runs: [],
    deterministic: false,
    flaggedUnstable: aggregation.flaggedUnstable,
    unitResults,
    unitsSelected: selection.units.length,
    unitsCapped: selection.unitsCapped,
    unitsInvalidByCause: countInvalidByCause(votes),
    ...(instruction.judgeUnit === 'module' ? { singleFileModules: selectedModules.filter((u) => u.singleFile).length } : {}),
    candidateExclusions: candidates.exclusions,
    candidateCount: candidates.units.length,
    uncoveredFileCount: candidates.uncoveredFiles.length,
    truncatedUnits: contexts.filter((c) => c.truncated).length,
    excerptTruncatedUnits: contexts.filter((c) => c.excerptTruncated).length,
    ...(selection.selection.source === 'baseline' ? { removedByVariant: selection.removedByVariant } : {}),
    selection: selection.selection,
    aggregationRule: aggregation.aggregationRule,
    candidatesByLayer: candidatesByLayerOf(candidates.units),
  };
  return { kind: 'result', result, warnings };
}

/** ADR-028: candidate units per layer (N_h of the proportional scoring variant), keys sorted. */
export function candidatesByLayerOf(units: readonly { readonly layer: string }[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.layer, (counts.get(u.layer) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
