/**
 * C15.4 re-scorer (FR-26; BR-U5b-57..60; U5b domain-entities §4, §10; business-logic-model §4).
 *
 * - Inputs (BR-U5b-57) come from the stored report: `evaluationMode`, the `scoring` block (`weights`,
 *   `fullModeWeights`, `thresholds`, `confidenceThresholds`, `verdictSource`) and the per-dimension AVR inputs
 *   (`perDimensionScores[].violatedWeight`, `functionCount`). Only when the block is missing is the spec re-parsed
 *   (C3 `parseSpec`) from a file whose sha256 equals `RunRecord.specSha`; the result then carries
 *   `inputSource = 'spec-reparse'`.
 * - Reproduction (BR-U5b-58): every AHS field the mode produces is recomputed with the scorer's own code
 *   (`avrOf` rounding, `renormaliseWeights`, `computeAHS`, `determineVerdict`) and must equal the stored value at
 *   3 dp, with the verdict recomputed from the field named by `verdictSource`; any difference is
 *   `RESCORE_MISMATCH`, an error, never a warning.
 * - Leave-one-dimension-out (BR-U5b-59): each executed dimension is dropped in turn and every AHS field present is
 *   recomputed over the remaining executed dimensions; the row is marked `ablated`. `droppedDimensions` stays the
 *   report's (U3 reasons only).
 * - Sensitivity only (BR-U5b-60): threshold band sweeps and the neural aggregation variants (`majority`,
 *   `any-fail`, `share`, and ADR-028 `proportional` when every judged row carries `candidatesByLayer`) recomputed
 *   from the persisted `neuralResults[].unitResults`. The stored contribution that a variant replaces is the one of
 *   the report's own `scoring.neuralAggregation` (`majority` for `registered` or absent, `proportional`). Confidence
 *   thresholds are not swept (only stored AVR inputs are re-weighted); every such row is `purpose = 'sensitivity-only'`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renormaliseWeights } from '../src/scoring-engine/renormaliser.js';
import { avrOf, computeAHS, inModeDimensions, tallyDimensions, verdictSourceOf } from '../src/scoring-engine/score-computer.js';
import { determineVerdict } from '../src/scoring-engine/verdict.js';
import { proportionalShare } from '../src/scoring-engine/neural-aggregation.js';
import { parseSpec } from '../src/spec-parser/spec-parser.js';
import type { Dimension, EvaluationMode, OverallVerdict } from '../src/shared/types/enums.js';
import type {
  DroppedDimension, EvaluationReport, NeuralUnitRow, NeuronalFunctionResult, ReportScoring,
} from '../src/shared/types/evaluation.js';
import type { ConfidenceThresholds, ScoringWeights, VerdictThresholds } from '../src/shared/types/spec.js';
import type { AHSScore, AVRScore, Confidence, FunctionId } from '../src/shared/types/value-objects.js';

export const RESCORE_MISMATCH = 'RESCORE_MISMATCH';
export const RESCORE_INPUT_MISSING = 'RESCORE_INPUT_MISSING';

// Dimension sets through the whitelisted C8 `inModeDimensions` (BR-U5b-55: no value import of `src/shared/types`).
const DIMENSIONS = inModeDimensions('full');
const SYMBOLIC_DIMENSIONS = inModeDimensions('symbolic-only');
const MODEL_JUDGED_DIMENSIONS = inModeDimensions('neuronal-only');

export type AhsField = ReportScoring['verdictSource'];
/** Stored AHS fields in report order (U3 §4.6; there is no `ahs` field). */
export const AHS_FIELDS: readonly AhsField[] = ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'];
export type NeuralAggregation = 'majority' | 'any-fail' | 'share' | 'proportional';
export const NEURAL_AGGREGATIONS: readonly NeuralAggregation[] = ['majority', 'any-fail', 'share', 'proportional'];

/** Default threshold band offsets of the sensitivity sweep, applied to all three shipped thresholds. */
export const DEFAULT_THRESHOLD_BANDS: readonly number[] = [-0.05, 0.05];

// ---------------------------------------------------------------------------------------------
// Types (domain-entities §4)

export interface RescoreScenario {
  readonly id: string;
  readonly weights: ScoringWeights;
  readonly thresholds: VerdictThresholds;
  readonly dropDimension?: Dimension;
  readonly neuralAggregation?: NeuralAggregation;
  readonly purpose: 'reproduction' | 'ablation' | 'sensitivity-only';
}

export interface RescoreResult {
  readonly scenarioId: string;
  readonly purpose: RescoreScenario['purpose'];
  readonly inputSource: 'report' | 'spec-reparse';
  readonly evaluationMode: EvaluationMode;
  readonly verdictSource: AhsField;
  readonly thresholds: VerdictThresholds;
  readonly neuralAggregation?: NeuralAggregation;
  readonly avr: ReadonlyMap<Dimension, number>;
  /** Effective weights of the verdict-source field (unrounded), executed dimensions only. */
  readonly effectiveWeights: ReadonlyMap<Dimension, number>;
  readonly ahs: { readonly ahsDeterministic?: number; readonly ahsCombined?: number; readonly ahsNeuronal?: number };
  /** From the field named by `verdictSource`; null when that field has no executed weight in the scenario. */
  readonly verdict: OverallVerdict | null;
  readonly droppedDimensions: readonly DroppedDimension[];
  readonly ablated?: Dimension;
  readonly reproducesStored?: boolean;
}

/** The re-scoring inputs (BR-U5b-57), from the report or, as fallback, from the re-parsed spec. */
export interface RescoreInputs {
  readonly source: 'report' | 'spec-reparse';
  readonly evaluationMode: EvaluationMode;
  readonly weights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly thresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly verdictSource: AhsField;
}

/** A stored report as the re-scorer reads it: the `scoring` block may be missing (fallback, BR-U5b-57). */
export type RescorableReport = Omit<EvaluationReport, 'scoring'> & { readonly scoring?: ReportScoring };

/** The scoring values of a re-parsed spec (C3 `ParsedSpec` subset). */
export interface SpecScoring {
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly verdictThresholds: VerdictThresholds;
  readonly confidenceThresholds: ConfidenceThresholds;
}

export interface RescoreOptions {
  /** Needed only when the report has no `scoring` block. */
  readonly specScoring?: SpecScoring;
  /** Offsets added to every shipped threshold for the sensitivity sweep. */
  readonly thresholdBands?: readonly number[];
}

export interface RescoreOutput {
  readonly runId: string;
  readonly inputSource: 'report' | 'spec-reparse';
  readonly reproduction: RescoreResult;
  readonly ablations: readonly RescoreResult[];
  readonly sensitivity: readonly RescoreResult[];
}

export type RescoreOutcome =
  | { readonly ok: true; readonly value: RescoreOutput }
  | { readonly ok: false; readonly code: typeof RESCORE_MISMATCH | typeof RESCORE_INPUT_MISSING; readonly detail: string };

// ---------------------------------------------------------------------------------------------
// Inputs (BR-U5b-57)

export function resolveInputs(report: RescorableReport, specScoring?: SpecScoring): RescoreInputs | string {
  const mode = report.evaluationMode;
  const s = report.scoring;
  if (s !== undefined) {
    return {
      source: 'report', evaluationMode: mode, weights: s.weights,
      ...(s.fullModeWeights !== undefined && { fullModeWeights: s.fullModeWeights }),
      thresholds: s.thresholds, confidenceThresholds: s.confidenceThresholds, verdictSource: s.verdictSource,
    };
  }
  if (specScoring === undefined) return `report ${report.runId} has no scoring block and no spec was re-parsed`;
  return {
    source: 'spec-reparse', evaluationMode: mode, weights: specScoring.scoringWeights,
    ...(specScoring.fullModeWeights !== undefined && { fullModeWeights: specScoring.fullModeWeights }),
    thresholds: specScoring.verdictThresholds, confidenceThresholds: specScoring.confidenceThresholds,
    verdictSource: verdictSourceOf(mode),
  };
}

/** Fallback (BR-U5b-57): re-parse the spec file whose bytes hash to `specSha` (C3 `parseSpec`). */
export async function reparseSpecScoring(specPath: string, specSha: string): Promise<{ ok: true; value: SpecScoring } | { ok: false; detail: string }> {
  if (!existsSync(specPath)) return { ok: false, detail: `spec ${specPath} not found` };
  const sha = createHash('sha256').update(readFileSync(specPath)).digest('hex');
  if (sha !== specSha) return { ok: false, detail: `spec ${specPath} sha256 ${sha} != RunRecord.specSha ${specSha}` };
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) return { ok: false, detail: `spec ${specPath} does not parse: ${parsed.errors.map((e) => e.message).join('; ')}` };
  const d = parsed.data;
  return {
    ok: true,
    value: {
      scoringWeights: d.scoringWeights, verdictThresholds: d.verdictThresholds, confidenceThresholds: d.confidenceThresholds,
      ...(d.fullModeWeights !== undefined && { fullModeWeights: d.fullModeWeights }),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Core recomputation

/** Candidate (in-mode) dimensions of each AHS field (U3 domain-entities §4.2, §4.6). */
export function candidateDimensions(field: AhsField): readonly Dimension[] {
  switch (field) {
    case 'ahsDeterministic':
      return SYMBOLIC_DIMENSIONS;
    case 'ahsCombined':
      return DIMENSIONS;
    case 'ahsNeuronal':
      return MODEL_JUDGED_DIMENSIONS;
  }
}

/** AHS fields the scorer produces for a mode (U3 `scoreDimensions`). */
export function fieldsOfMode(mode: EvaluationMode): readonly AhsField[] {
  switch (mode) {
    case 'symbolic-only':
      return ['ahsDeterministic'];
    case 'neuronal-only':
      return ['ahsNeuronal'];
    case 'full':
      return AHS_FIELDS;
  }
}

function weightsOf(field: AhsField, inputs: RescoreInputs): ScoringWeights | undefined {
  return field === 'ahsDeterministic' ? inputs.weights : inputs.fullModeWeights;
}

/** Per-dimension AVR inputs: `violatedWeight` (unrounded numerator) and `functionCount`. */
export type DimensionInputs = ReadonlyMap<Dimension, { readonly violatedWeight: number; readonly functionCount: number }>;

export function dimensionInputs(report: RescorableReport): DimensionInputs {
  const out = new Map<Dimension, { violatedWeight: number; functionCount: number }>();
  for (const p of report.perDimensionScores) {
    if (p.functionCount > 0) out.set(p.dimension, { violatedWeight: p.violatedWeight, functionCount: p.functionCount });
  }
  return out;
}

/** AVR with the scorer's rounding (`avrOf`: round3, capped at 1). */
function avrMap(inputs: DimensionInputs): Map<Dimension, AVRScore> {
  const out = new Map<Dimension, AVRScore>();
  for (const d of DIMENSIONS) {
    const x = inputs.get(d);
    if (x !== undefined) out.set(d, avrOf({ functionCount: x.functionCount, violatedWeight: x.violatedWeight, violationCount: 0 }));
  }
  return out;
}

interface FieldScore {
  readonly ahs?: number;
  readonly effectiveWeights: ReadonlyMap<Dimension, number>;
}

/**
 * One AHS field: the field's candidate dimensions that executed (minus `drop`), renormalised (`renormaliseWeights`)
 * and scored (`computeAHS`). No executed weight → no value, as the scorer omits the field.
 */
function scoreField(field: AhsField, inputs: RescoreInputs, avrs: ReadonlyMap<Dimension, AVRScore>, drop?: Dimension): FieldScore {
  const weights = weightsOf(field, inputs);
  if (weights === undefined) return { effectiveWeights: new Map() };
  const dims = candidateDimensions(field).filter((d) => d !== drop && avrs.has(d));
  const executed = Object.fromEntries(dims.map((d) => [d, 1]));
  const r = renormaliseWeights(weights, executed, {}, {}, dims);
  const effectiveWeights = new Map(dims.flatMap((d) => (r.effectiveWeights[d] !== undefined ? [[d, r.effectiveWeights[d]] as const] : [])));
  if (r.executedWeight <= 0) return { effectiveWeights };
  const sub = new Map(dims.flatMap((d) => {
    const a = avrs.get(d);
    return a === undefined ? [] : [[d, a] as const];
  }));
  return { ahs: Number(computeAHS(sub, weights)), effectiveWeights };
}

interface ScenarioSpec {
  readonly id: string;
  readonly purpose: RescoreScenario['purpose'];
  readonly thresholds: VerdictThresholds;
  readonly drop?: Dimension;
  readonly neuralAggregation?: NeuralAggregation;
}

function runScenario(
  report: RescorableReport, inputs: RescoreInputs, dims: DimensionInputs, fields: readonly AhsField[], s: ScenarioSpec,
): RescoreResult {
  const avrs = avrMap(dims);
  const ahs: Partial<Record<AhsField, number>> = {};
  let sourceWeights: ReadonlyMap<Dimension, number> = new Map();
  for (const f of fields) {
    const r = scoreField(f, inputs, avrs, s.drop);
    if (r.ahs !== undefined) ahs[f] = r.ahs;
    if (f === inputs.verdictSource) sourceWeights = r.effectiveWeights;
  }
  const v = ahs[inputs.verdictSource];
  return {
    scenarioId: s.id, purpose: s.purpose, inputSource: inputs.source, evaluationMode: inputs.evaluationMode,
    verdictSource: inputs.verdictSource, thresholds: s.thresholds,
    ...(s.neuralAggregation !== undefined && { neuralAggregation: s.neuralAggregation }),
    avr: new Map([...avrs].map(([d, a]) => [d, Number(a)] as const)),
    effectiveWeights: sourceWeights,
    ahs,
    verdict: v === undefined ? null : determineVerdict(v as AHSScore, s.thresholds),
    droppedDimensions: report.droppedDimensions,
    ...(s.drop !== undefined && { ablated: s.drop }),
  };
}

const fmt3 = (x: number | undefined): string => (x === undefined ? 'absent' : x.toFixed(3));

/** BR-U5b-58: every AHS field of the mode and the verdict equal their stored values at 3 dp. */
function reproductionMismatches(report: RescorableReport, inputs: RescoreInputs, r: RescoreResult): string[] {
  const problems: string[] = [];
  if (inputs.verdictSource !== verdictSourceOf(inputs.evaluationMode)) {
    problems.push(`verdictSource ${inputs.verdictSource} is not the ${inputs.evaluationMode} source ${verdictSourceOf(inputs.evaluationMode)}`);
  }
  for (const f of AHS_FIELDS) {
    const storedRaw = report[f];
    const stored = storedRaw === undefined ? undefined : Number(storedRaw);
    const recomputed = r.ahs[f];
    if (fmt3(stored) !== fmt3(recomputed)) problems.push(`${f}: stored ${fmt3(stored)} != recomputed ${fmt3(recomputed)}`);
  }
  if (r.verdict !== report.verdict) problems.push(`verdict: stored ${report.verdict} != recomputed ${String(r.verdict)} (from ${inputs.verdictSource})`);
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Neural aggregation variants (BR-U5b-60; U4 BR-U4-AGG-04 for `majority`)

export interface AggregatedFunction {
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: number;
  readonly flaggedUnstable: boolean;
  /** Valid units failing / valid units (the `share` contribution). */
  readonly failShare: number;
  /** ADR-028 inclusion-weighted share (the `proportional` contribution); set only for that rule. */
  readonly proportionalShare?: number;
}

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Function verdict from the persisted unit rows. `majority` is U4's `majority-of-valid-units-v1`: `fail` when strictly
 * more than half of the valid units fail, else `warning` when a valid unit fails or warns, else `pass`; confidence and
 * instability from the units carrying the verdict (fail: failing units; pass: passing; warning: all valid), unstable
 * when strictly more than half of them are. `any-fail`: `fail` when at least one valid unit fails (carried by the
 * failing units), otherwise as `majority`. `share` keeps the `majority` verdict; its AVR contribution is `failShare`.
 * No valid unit → undefined (U4 emits no result).
 */
export function aggregateUnits(units: readonly NeuralUnitRow[], rule: NeuralAggregation): AggregatedFunction | undefined {
  const valid = units.filter((u) => u.status === 'valid');
  if (valid.length === 0) return undefined;
  const failing = valid.filter((u) => u.verdict === 'fail');
  const failShare = failing.length / valid.length;
  const carried = (verdict: AggregatedFunction['verdict'], carriers: readonly NeuralUnitRow[]): AggregatedFunction => ({
    verdict,
    confidence: mean(carriers.map((u) => u.confidence)),
    flaggedUnstable: carriers.filter((u) => u.flaggedUnstable).length * 2 > carriers.length,
    failShare,
  });
  if (rule === 'any-fail' && failing.length > 0) return carried('fail', failing);
  if (failing.length * 2 > valid.length) return carried('fail', failing);
  if (failing.length > 0 || valid.some((u) => u.verdict === 'warning')) return carried('warning', valid);
  return carried('pass', valid.filter((u) => u.verdict === 'pass'));
}

/** `violatedWeight` contribution of one judged function, through the scorer's own `tallyDimensions`. */
function contributionOf(dimension: Dimension, agg: AggregatedFunction, thresholds: ConfidenceThresholds): number {
  const fn: NeuronalFunctionResult = {
    functionId: 'rescore' as FunctionId, dimension, verdict: agg.verdict, confidence: Math.min(1, Math.max(0, agg.confidence)) as Confidence,
    confidenceStdDev: 0, icc: 1, reasoning: '', evidence: [], violations: [], runs: [], deterministic: false,
    flaggedUnstable: agg.flaggedUnstable, unitResults: [], unitsSelected: 0, unitsCapped: 0,
  };
  return tallyDimensions({ symbolicResults: [], neuronalResults: [fn] }, thresholds).get(dimension)?.violatedWeight ?? 0;
}

/** The aggregation whose contribution the stored `violatedWeight` holds (ADR-028; absent = registered = `majority`). */
export function storedAggregationOf(report: RescorableReport): NeuralAggregation {
  return report.scoring?.neuralAggregation === 'proportional' ? 'proportional' : 'majority';
}

/** True when every judged (route `neuronal`) row carries `candidatesByLayer`, so `proportional` can be recomputed. */
export function proportionalAvailable(report: RescorableReport): boolean {
  const routes = new Map(report.functionResults.map((r) => [String(r.functionId), r.route] as const));
  const rows = (report.neuralResults ?? []).filter((row) => routes.get(String(row.functionId)) === 'neuronal');
  return rows.length > 0 && rows.every((row) => row.candidatesByLayer !== undefined);
}

/** Per judged function (route `neuronal`), the verdict under `rule`; hybrids keep their stored contribution. */
export function neuralVerdicts(
  report: RescorableReport, rule: NeuralAggregation, thresholds?: ConfidenceThresholds,
): ReadonlyMap<string, AggregatedFunction> {
  const routes = new Map(report.functionResults.map((r) => [String(r.functionId), r.route] as const));
  const out = new Map<string, AggregatedFunction>();
  for (const row of report.neuralResults ?? []) {
    if (routes.get(String(row.functionId)) !== 'neuronal') continue;
    const agg = aggregateUnits(row.unitResults, rule === 'proportional' ? 'majority' : rule);
    if (agg === undefined) continue;
    if (rule === 'proportional') {
      const p = proportionalShare(row.unitResults, row.candidatesByLayer, thresholds ?? report.scoring?.confidenceThresholds);
      out.set(String(row.functionId), { ...agg, proportionalShare: p?.share ?? 0 });
    } else {
      out.set(String(row.functionId), agg);
    }
  }
  return out;
}

function variantContributionOf(rule: NeuralAggregation, d: Dimension, v: AggregatedFunction, thresholds: ConfidenceThresholds): number {
  if (rule === 'share') return v.failShare;
  if (rule === 'proportional') return v.proportionalShare ?? 0;
  return contributionOf(d, v, thresholds);
}

/**
 * Dimension inputs with the judged functions' contributions recomputed under `rule`: the stored contribution (that of
 * `storedAggregationOf(report)`: `majority`, which equals U4 AGG-04 under the registered rule, or `proportional`) is
 * replaced by the variant's. Confidence thresholds stay the shipped ones.
 */
export function aggregatedInputs(report: RescorableReport, inputs: RescoreInputs, rule: NeuralAggregation): DimensionInputs {
  const base = new Map<Dimension, { violatedWeight: number; functionCount: number }>(
    [...dimensionInputs(report)].map(([d, x]) => [d, { violatedWeight: x.violatedWeight, functionCount: x.functionCount }]),
  );
  const storedRule = storedAggregationOf(report);
  const stored = neuralVerdicts(report, storedRule, inputs.confidenceThresholds);
  const variant = neuralVerdicts(report, rule, inputs.confidenceThresholds);
  const dims = new Map((report.neuralResults ?? []).map((r) => [String(r.functionId), r.dimension] as const));
  for (const [id, m] of stored) {
    const d = dims.get(id);
    const v = variant.get(id);
    const entry = d === undefined ? undefined : base.get(d);
    if (d === undefined || v === undefined || entry === undefined) continue;
    entry.violatedWeight += variantContributionOf(rule, d, v, inputs.confidenceThresholds)
      - variantContributionOf(storedRule, d, m, inputs.confidenceThresholds);
  }
  return base;
}

// ---------------------------------------------------------------------------------------------
// Entry point

const round2 = (x: number): number => Math.round(x * 100) / 100;

export function bandThresholds(t: VerdictThresholds, offset: number): VerdictThresholds {
  return { pass: round2(t.pass + offset), warning: round2(t.warning + offset), softBlock: round2(t.softBlock + offset) };
}

export function thresholdsLabel(t: VerdictThresholds): string {
  return `${t.pass.toFixed(2)}/${t.warning.toFixed(2)}/${t.softBlock.toFixed(2)}`;
}

/** BR-U5b-57..60 on one stored report. */
export function rescoreReport(report: RescorableReport, options: RescoreOptions = {}): RescoreOutcome {
  const inputs = resolveInputs(report, options.specScoring);
  if (typeof inputs === 'string') return { ok: false, code: RESCORE_INPUT_MISSING, detail: inputs };
  if (inputs.evaluationMode !== 'symbolic-only' && inputs.fullModeWeights === undefined) {
    return { ok: false, code: RESCORE_INPUT_MISSING, detail: `${inputs.evaluationMode} report ${report.runId} has no fullModeWeights` };
  }
  const fields = fieldsOfMode(inputs.evaluationMode);
  const dims = dimensionInputs(report);
  const shipped = inputs.thresholds;

  const reproduced = runScenario(report, inputs, dims, fields, { id: 'reproduction', purpose: 'reproduction', thresholds: shipped });
  const mismatches = reproductionMismatches(report, inputs, reproduced);
  if (mismatches.length > 0) {
    return { ok: false, code: RESCORE_MISMATCH, detail: `${report.runId} (${report.projectPath}): ${mismatches.join('; ')}` };
  }
  const reproduction: RescoreResult = { ...reproduced, reproducesStored: true };

  const ablations = DIMENSIONS.filter((d) => dims.has(d)).map((d) =>
    runScenario(report, inputs, dims, fields, { id: `ablate:${d}`, purpose: 'ablation', thresholds: shipped, drop: d }));

  const sensitivity: RescoreResult[] = [];
  for (const offset of options.thresholdBands ?? DEFAULT_THRESHOLD_BANDS) {
    const t = bandThresholds(shipped, offset);
    sensitivity.push(runScenario(report, inputs, dims, fields, { id: `thresholds:${thresholdsLabel(t)}`, purpose: 'sensitivity-only', thresholds: t }));
  }
  if ((report.neuralResults ?? []).length > 0) {
    const storedRule = storedAggregationOf(report);
    const withProportional = proportionalAvailable(report);
    for (const rule of NEURAL_AGGREGATIONS) {
      if (rule === 'proportional' && !withProportional) continue;
      const r = runScenario(report, inputs, aggregatedInputs(report, inputs, rule), fields, {
        id: `neural:${rule}`, purpose: 'sensitivity-only', thresholds: shipped, neuralAggregation: rule,
      });
      sensitivity.push(rule === storedRule ? { ...r, reproducesStored: reproductionMismatches(report, inputs, r).length === 0 } : r);
    }
  }
  return { ok: true, value: { runId: report.runId, inputSource: inputs.source, reproduction, ablations, sensitivity } };
}

// ---------------------------------------------------------------------------------------------
// CSVs (domain-entities §10)

export const ABLATION_COLUMNS = ['run_id', 'ablated', 'ahs_source', 'ahs', 'verdict', 'delta_ahs'] as const;
export const SENSITIVITY_COLUMNS = ['run_id', 'scenario_id', 'purpose', 'thresholds', 'neural_aggregation', 'ahs_source', 'ahs', 'verdict'] as const;

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function csv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

const cell3 = (x: number | undefined): string => (x === undefined ? '' : x.toFixed(3));

/** `rescore_ablation.csv`: run × ablated dimension × AHS field present whose candidate set holds that dimension. */
export function ablationCsv(outputs: readonly RescoreOutput[]): string {
  const rows: string[][] = [];
  for (const o of outputs) {
    for (const a of o.ablations) {
      for (const f of AHS_FIELDS) {
        const base = o.reproduction.ahs[f];
        // A field whose candidate set does not hold the ablated dimension is unchanged by construction: no row.
        if (base === undefined || a.ablated === undefined || !candidateDimensions(f).includes(a.ablated)) continue;
        const v = a.ahs[f];
        rows.push([o.runId, a.ablated ?? '', f, cell3(v), a.verdict ?? '', v === undefined ? '' : (v - base).toFixed(3)]);
      }
    }
  }
  return csv(ABLATION_COLUMNS, rows);
}

/** `rescore_sensitivity.csv`: run × scenario × AHS field present; every row `sensitivity-only` (BR-U5b-60). */
export function sensitivityCsv(outputs: readonly RescoreOutput[]): string {
  const rows: string[][] = [];
  for (const o of outputs) {
    for (const s of o.sensitivity) {
      for (const f of AHS_FIELDS) {
        if (o.reproduction.ahs[f] === undefined) continue;
        rows.push([o.runId, s.scenarioId, s.purpose, thresholdsLabel(s.thresholds), s.neuralAggregation ?? '', f, cell3(s.ahs[f]), s.verdict ?? '']);
      }
    }
  }
  return csv(SENSITIVITY_COLUMNS, rows);
}

/** JSON-ready copy of a result (maps as sorted objects). */
export function resultToJson(r: RescoreResult): Record<string, unknown> {
  return { ...r, avr: Object.fromEntries(r.avr), effectiveWeights: Object.fromEntries(r.effectiveWeights) };
}

// ---------------------------------------------------------------------------------------------
// CLI main (BR-U5b-73)

export const RESCORE_USAGE = [
  'usage: rescore --report <report.json> [--record <run.json>] [--spec <spec.yaml>] ... [--bands <o1,o2,...>] [--out-dir <dir>]',
  '  --report  stored report (repeatable; each may be followed by its --record and --spec)',
  '  --record  RunRecord of the preceding report (needed for the spec re-parse fallback)',
  '  --spec    spec file whose sha256 equals RunRecord.specSha (fallback only)',
  '  --bands   threshold offsets of the sensitivity sweep (default -0.05,0.05)',
  '  --out-dir write rescore_ablation.csv and rescore_sensitivity.csv there; otherwise JSON on stdout',
  '       rescore --self-test   run a built-in known-bad report (exits 1, BR-U5b-73)',
  '',
].join('\n');

/** Built-in known-bad input for `--self-test` (BR-U5b-73): a report with no `scoring` block and no re-parsed spec. */
export const SELF_TEST_REPORT = { runId: 'self-test', projectPath: '<self-test>', evaluationMode: 'symbolic-only' } as unknown as RescorableReport;

export interface RescoreMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (file: string, text: string) => void;
}

interface ReportArg { report: string; record?: string; spec?: string }

function parseArgs(argv: readonly string[]): { reports: ReportArg[]; bands?: number[]; outDir?: string; help: boolean } | string {
  const reports: ReportArg[] = [];
  let bands: number[] | undefined;
  let outDir: string | undefined;
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (a === '--help') {
      help = true;
      continue;
    }
    const v = argv[i + 1];
    if (!['--report', '--record', '--spec', '--bands', '--out-dir'].includes(a)) return `unknown argument ${a}`;
    if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
    i += 1;
    if (a === '--report') reports.push({ report: v });
    else if (a === '--bands') {
      const xs = v.split(',').map(Number);
      if (xs.some((x) => !Number.isFinite(x))) return `--bands ${v} is not a list of numbers`;
      bands = xs;
    } else if (a === '--out-dir') outDir = v;
    else {
      const last = reports[reports.length - 1];
      if (last === undefined) return `${a} must follow a --report`;
      if (a === '--record') last.record = v;
      else last.spec = v;
    }
  }
  return { reports, ...(bands !== undefined && { bands }), ...(outDir !== undefined && { outDir }), help };
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export async function main(argv: readonly string[], repoRoot: string, io: RescoreMainIo): Promise<number> {
  if (argv.includes('--self-test')) {
    const r = rescoreReport(SELF_TEST_REPORT);
    io.err(r.ok ? 'self-test: known-bad report was re-scored\n' : `self-test: ${r.code}: ${r.detail}\n`);
    return 1;
  }
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n${RESCORE_USAGE}`);
    return 2;
  }
  if (args.help) {
    io.out(RESCORE_USAGE);
    return 0;
  }
  if (args.reports.length === 0) {
    io.err(`--report is required\n${RESCORE_USAGE}`);
    return 2;
  }
  const outputs: RescoreOutput[] = [];
  for (const a of args.reports) {
    let report: RescorableReport;
    let specSha: string | undefined;
    try {
      report = readJsonFile(resolve(repoRoot, a.report)) as RescorableReport;
      if (a.record !== undefined) {
        const rec = readJsonFile(resolve(repoRoot, a.record)) as { specSha?: unknown };
        if (typeof rec.specSha === 'string') specSha = rec.specSha;
      }
    } catch (e) {
      io.err(`input error: ${e instanceof Error ? e.message : String(e)}\n`);
      return 2;
    }
    let specScoring: SpecScoring | undefined;
    if (report.scoring === undefined) {
      if (a.spec === undefined || specSha === undefined) {
        io.err(`${RESCORE_INPUT_MISSING}: ${a.report} has no scoring block; give --record and --spec for the re-parse fallback\n`);
        return 1;
      }
      const parsed = await reparseSpecScoring(resolve(repoRoot, a.spec), specSha);
      if (!parsed.ok) {
        io.err(`${RESCORE_INPUT_MISSING}: ${parsed.detail}\n`);
        return 1;
      }
      specScoring = parsed.value;
    }
    const r = rescoreReport(report, {
      ...(specScoring !== undefined && { specScoring }),
      ...(args.bands !== undefined && { thresholdBands: args.bands }),
    });
    if (!r.ok) {
      io.err(`${r.code}: ${r.detail}\n`);
      return 1;
    }
    outputs.push(r.value);
  }
  if (args.outDir !== undefined) {
    io.writeFile(resolve(repoRoot, args.outDir, 'rescore_ablation.csv'), ablationCsv(outputs));
    io.writeFile(resolve(repoRoot, args.outDir, 'rescore_sensitivity.csv'), sensitivityCsv(outputs));
  } else {
    io.out(`${JSON.stringify(outputs.map((o) => ({
      runId: o.runId, inputSource: o.inputSource, reproduction: resultToJson(o.reproduction),
      ablations: o.ablations.map(resultToJson), sensitivity: o.sensitivity.map(resultToJson),
    })), null, 2)}\n`);
  }
  return 0;
}
