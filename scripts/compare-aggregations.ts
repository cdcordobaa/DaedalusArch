/**
 * Registered vs proportional neural aggregation and the judge-effect decomposition, per project (ADR-028;
 * `Docs/analysis-plan.md` §12.3, §10 B9).
 *
 * Inputs: two harness output directories of the same plan, the registered reading (`--registered`, reports whose
 * `scoring.neuralAggregation` is `registered` or absent) and the variant reading (`--variant`, `proportional`), paired
 * by project id and spec sha. Refused (`COMPARE_INPUT_INVALID`) when a pair is missing, a report carries the wrong rule,
 * the rules-only AHS of a pair differs (both readings come from the same code and the same judge calls), or the stored
 * `ahsCombined` does not reproduce from the stored AVRs.
 *
 * - `ahs_by_aggregation.csv`: per project the rules-only `ahsDeterministic` with the verdict its thresholds give,
 *   `ahsCombined` and `ahsNeuronal` under each rule, the Semantic and Integrity AVR under each rule, the verdict under
 *   each rule and `verdict_changed`, `same_judge_units`, and the **judge-effect decomposition** (v15, a pure function of
 *   the stored reports, no re-run):
 *   - `w_neural` = W_n, the renormalised full-mode weight of the executed judge dimensions; `judge_bound` = −W_n, the
 *     lowest the judge can move `ahsCombined` (every neural AVR at 1); the judge can never raise it above the
 *     judge-blind value;
 *   - `ahs_combined_judge_blind` = `ahsCombined` with every neural AVR set to 0; `verdict_judge_blind` its verdict;
 *   - `delta_dilution` = judge-blind `ahsCombined` − `ahsDeterministic` (the weighting artefact: ≈ W_n · weighted mean
 *     symbolic AVR, `dilution_identity` = W_n · (1 − `ahsDeterministic`), exact when the full-mode symbolic weights are
 *     proportional to the symbolic ones);
 *   - `delta_judge_<rule>` = `ahsCombined` − judge-blind `ahsCombined`; `judge_mattered_<rule>` = (verdict_judge_blind ≠
 *     the rule's verdict);
 *   - `verdict_any_fail` (BR-U5b-60 `any-fail` re-score of the registered report) beside the proportional verdict.
 *   `reading` is derived, never chosen: `post-hoc` when the registered run's `preregVersion` < 14 (the ADR-028
 *   registration), else `pre-registered`; a `--reading` that contradicts it is refused. Both prereg versions are columns.
 *   - **judge-weighted sensitivity variant `judge-weighted-v1`** (v17, §12.5; a pure function of the stored reports, no
 *     re-run, no LLM): the executed full-mode effective weights rescaled so the executed judge dimensions together weigh
 *     2/7 and the executed symbolic dimensions 5/7, each group proportionally, so they still sum to 1; same thresholds.
 *     Per rule (`registered`, `proportional`, `any_fail`): `ahs_combined_jw_<rule>`, `verdict_jw_<rule>`,
 *     `delta_jw_<rule>` (minus the same rule's AHS under the registered weights), `verdict_changed_jw_<rule>`,
 *     `delta_judge_jw_<rule>` and `judge_mattered_jw_<rule>` (against the judge-blind AHS under the judge-weighted
 *     weights); `w_neural_jw` = 2/7 and `judge_bound_jw` = −2/7. `reading_judge_weighted` is `post-hoc` when the
 *     registered run's `preregVersion` < 17, else `pre-registered`.
 * - `neural_contributions.csv`: per project and judged function, the registered contribution (U4 majority verdict and
 *   the U3 confidence weight), the proportional share, the confidence-free share and the strata (`layer:N_h/V_h/failed`).
 */
import { join, resolve } from 'node:path';
import type { EvaluationReport, NeuralResultRow } from '../src/shared/types/evaluation.js';
import type { Dimension } from '../src/shared/types/enums.js';
import type { AHSScore, AVRScore } from '../src/shared/types/value-objects.js';
import { confidenceWeight, proportionalShare } from '../src/scoring-engine/neural-aggregation.js';
import { computeAHS } from '../src/scoring-engine/score-computer.js';
import { determineVerdict } from '../src/scoring-engine/verdict.js';
import { ahsFromEffectiveWeights, renormaliseWeights } from '../src/scoring-engine/renormaliser.js';
import { loadRunDir } from './lib/report-io.js';
import type { RunRecord } from './lib/report-io.js';
import { aggregateUnits, rescoreReport } from './rescore.js';

export const COMPARE_INPUT_INVALID = 'COMPARE_INPUT_INVALID';
/** The prereg version that registered the ADR-028 variant: a registered run before it gives a post-hoc reading. */
export const ADR028_PREREG_VERSION = 14;
const JUDGE_DIMENSIONS: readonly Dimension[] = ['semantic', 'integrity'];
/** The judge-weighted sensitivity variant (§12.5, prereg v17). */
export const JUDGE_WEIGHTED_VARIANT = 'judge-weighted-v1';
/** Joint weight of the executed judge dimensions under `judge-weighted-v1`: 2 of the 7 dimensions. */
export const JUDGE_WEIGHTED_SHARE = 2 / 7;
/** The prereg version that registered `judge-weighted-v1`: a registered run before it gives a post-hoc reading. */
export const JUDGE_WEIGHTED_PREREG_VERSION = 17;
const JW_RULES = ['registered', 'proportional', 'any_fail'] as const;
type JwRule = typeof JW_RULES[number];

export const COMPARISON_COLUMNS = [
  'project_id', 'registered_run_id', 'variant_run_id', 'evaluation_mode', 'reading', 'registered_prereg_version', 'variant_prereg_version',
  'ahs_deterministic', 'verdict_rules_only',
  'ahs_combined_registered', 'ahs_combined_proportional', 'delta_combined', 'ahs_neuronal_registered', 'ahs_neuronal_proportional',
  'delta_neuronal', 'avr_semantic_registered', 'avr_semantic_proportional', 'avr_integrity_registered', 'avr_integrity_proportional',
  'verdict_registered', 'verdict_proportional', 'verdict_changed', 'same_judge_units',
  'w_neural', 'judge_bound', 'ahs_combined_judge_blind', 'verdict_judge_blind', 'delta_dilution', 'dilution_identity',
  'delta_judge_registered', 'delta_judge_proportional', 'judge_mattered_registered', 'judge_mattered_proportional',
  'ahs_combined_any_fail', 'verdict_any_fail', 'any_fail_changed',
  'reading_judge_weighted', 'w_neural_jw', 'judge_bound_jw', 'ahs_combined_jw_judge_blind', 'verdict_jw_judge_blind',
  ...JW_RULES.flatMap((r) => [
    `ahs_combined_jw_${r}`, `verdict_jw_${r}`, `delta_jw_${r}`, `verdict_changed_jw_${r}`, `delta_judge_jw_${r}`, `judge_mattered_jw_${r}`,
  ] as const),
] as const;
export const CONTRIBUTION_COLUMNS = [
  'project_id', 'function_id', 'dimension', 'majority_verdict', 'registered_contribution', 'proportional_share',
  'proportional_share_confidence_free', 'units_selected', 'units_valid', 'units_failed', 'units_split_vote', 'candidate_count', 'strata',
] as const;

const f3 = (x: number | undefined): string => (x === undefined || !Number.isFinite(x) ? '' : x.toFixed(3));
const f6 = (x: number | undefined): string => (x === undefined || !Number.isFinite(x) ? '' : x.toFixed(6));
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const num = (x: unknown): number | undefined => (x === undefined || x === null ? undefined : Number(x));

export interface Run { readonly record: RunRecord; readonly report: EvaluationReport }

function acceptedRuns(dir: string): Run[] {
  const { records, reports } = loadRunDir(dir, COMPARE_INPUT_INVALID);
  return records.filter((r) => r.status === 'accepted').flatMap((record) => {
    const report = reports.get(record.runId);
    return report === undefined ? [] : [{ record, report }];
  });
}

const ruleOf = (r: EvaluationReport): string => r.scoring.neuralAggregation ?? 'registered';

function avrOf(r: EvaluationReport, d: string): number | undefined {
  return num(r.perDimensionScores.find((p) => p.dimension === d)?.avr);
}

/** The judged unit rows of a report, keyed by function, without `candidatesByLayer` (absent in older reports). */
function unitRowsOf(r: EvaluationReport): string {
  const rows = [...(r.neuralResults ?? [])].map((row) => {
    const { candidatesByLayer: _ignored, ...rest } = row;
    void _ignored;
    return rest;
  }).sort((a, b) => cmp(String(a.functionId), String(b.functionId)));
  return JSON.stringify(rows);
}

// ---------------------------------------------------------------------------------------------
// Judge-effect decomposition (v15; pure, from one stored report)

export interface JudgeDecomposition {
  /** W_n: renormalised full-mode weight of the executed judge dimensions. */
  readonly wNeural: number;
  readonly ahsCombined: number;
  readonly ahsCombinedJudgeBlind: number;
  readonly verdictJudgeBlind: string;
  readonly deltaDilution: number;
  readonly dilutionIdentity: number;
  readonly deltaJudge: number;
}

/** `undefined` for a report without `ahsCombined` (not full mode). Refuses when the stored AHS does not reproduce. */
export function judgeDecomposition(report: EvaluationReport): JudgeDecomposition | undefined {
  const stored = num(report.ahsCombined);
  const det = num(report.ahsDeterministic);
  const weights = report.scoring.fullModeWeights;
  if (stored === undefined || det === undefined || weights === undefined) return undefined;
  const avrs = new Map<Dimension, AVRScore>(report.perDimensionScores.map((p) => [p.dimension, p.avr]));
  const recomputed = Number(computeAHS(avrs, weights));
  if (recomputed.toFixed(3) !== stored.toFixed(3)) {
    throw new Error(`${COMPARE_INPUT_INVALID}: ${report.runId} ahsCombined ${stored.toFixed(3)} does not reproduce (${recomputed.toFixed(3)})`);
  }
  const blindAvrs = new Map([...avrs].map(([d, a]) => [d, (JUDGE_DIMENSIONS.includes(d) ? 0 : a) as AVRScore]));
  const blind = Number(computeAHS(blindAvrs, weights));
  const present = [...avrs.keys()];
  const total = present.reduce((a, d) => a + (weights[d] ?? 0), 0);
  const wNeural = total === 0 ? 0 : present.filter((d) => JUDGE_DIMENSIONS.includes(d)).reduce((a, d) => a + (weights[d] ?? 0), 0) / total;
  return {
    wNeural, ahsCombined: stored, ahsCombinedJudgeBlind: blind,
    verdictJudgeBlind: determineVerdict(blind as AHSScore, report.scoring.thresholds),
    deltaDilution: blind - det, dilutionIdentity: wNeural * (1 - det), deltaJudge: stored - blind,
  };
}

export interface AnyFailReading {
  readonly ahs?: number;
  readonly verdict: string;
  /** The per-dimension AVRs of the any-fail re-score (input of the judge-weighted reading). */
  readonly avr?: ReadonlyMap<Dimension, number>;
}

/** The BR-U5b-60 `any-fail` re-score of a registered report (`ahsCombined`, verdict and AVRs). */
export function anyFailReading(report: EvaluationReport): AnyFailReading {
  const r = rescoreReport(report);
  if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
  const s = r.value.sensitivity.find((x) => x.scenarioId === 'neural:any-fail');
  return { ...(s?.ahs.ahsCombined !== undefined && { ahs: s.ahs.ahsCombined }), verdict: s?.verdict ?? '', ...(s !== undefined && { avr: s.avr }) };
}

// ---------------------------------------------------------------------------------------------
// Judge-weighted sensitivity variant `judge-weighted-v1` (§12.5, prereg v17; pure, from the stored reports)

/**
 * `judge-weighted-v1` weights from the executed effective weights (renormalised, Σ = 1): the executed judge dimensions
 * scaled to sum to 2/7 and the executed symbolic dimensions to 5/7, each group proportionally. `undefined` when no
 * judge dimension or no symbolic dimension carries weight (the variant is not defined there).
 */
export function judgeWeightedWeights(effective: ReadonlyMap<Dimension, number>): Map<Dimension, number> | undefined {
  const isJudge = (d: Dimension): boolean => JUDGE_DIMENSIONS.includes(d);
  const total = [...effective.values()].reduce((a, w) => a + w, 0);
  const wn = [...effective].filter(([d]) => isJudge(d)).reduce((a, [, w]) => a + w, 0);
  const ws = total - wn;
  if (!(total > 0) || !(wn > 0) || !(ws > 0)) return undefined;
  return new Map([...effective].map(([d, w]) => [d, isJudge(d) ? (w / wn) * JUDGE_WEIGHTED_SHARE : (w / ws) * (1 - JUDGE_WEIGHTED_SHARE)] as const));
}

/** The full-mode effective weights of a report over its executed dimensions (`functionCount` > 0). */
export function fullModeEffectiveWeights(report: EvaluationReport): Map<Dimension, number> | undefined {
  const weights = report.scoring.fullModeWeights;
  if (weights === undefined) return undefined;
  const dims = report.perDimensionScores.filter((p) => p.functionCount > 0).map((p) => p.dimension);
  const r = renormaliseWeights(weights, Object.fromEntries(dims.map((d) => [d, 1])), {}, {}, dims);
  if (!(r.executedWeight > 0)) return undefined;
  return new Map(dims.map((d) => [d, r.effectiveWeights[d] ?? 0] as const));
}

/** `round3(1 − Σ w·AVR)` over the given weights (the scorer's AHS formula). */
function weightedAhs(weights: ReadonlyMap<Dimension, number>, avr: ReadonlyMap<Dimension, number>): number {
  return ahsFromEffectiveWeights(Object.fromEntries(weights), Object.fromEntries([...weights.keys()].map((d) => [d, avr.get(d) ?? 0])));
}

export interface JudgeWeightedRuleReading {
  readonly ahs: number;
  readonly verdict: string;
}

export interface JudgeWeightedReading {
  /** Effective joint weight of the judge dimensions under `judge-weighted-v1` (2/7). */
  readonly wNeural: number;
  readonly judgeBlind: JudgeWeightedRuleReading;
  readonly rules: Readonly<Partial<Record<JwRule, JudgeWeightedRuleReading>>>;
}

const avrMapOf = (r: EvaluationReport): Map<Dimension, number> =>
  new Map(r.perDimensionScores.filter((p) => p.functionCount > 0).map((p) => [p.dimension, Number(p.avr)] as const));

/**
 * `judge-weighted-v1` for one project or cell: the weights come from the registered report, the AVRs of each rule
 * from its own reading (the registered report, the proportional report, the any-fail re-score of the registered
 * report). `undefined` when the registered report is not a full-mode report or the variant is not defined.
 */
export function judgeWeightedReading(
  registered: EvaluationReport, variant?: EvaluationReport, anyFailAvr?: ReadonlyMap<Dimension, number>,
): JudgeWeightedReading | undefined {
  if (num(registered.ahsCombined) === undefined) return undefined;
  const effective = fullModeEffectiveWeights(registered);
  const weights = effective === undefined ? undefined : judgeWeightedWeights(effective);
  if (weights === undefined) return undefined;
  const thresholds = registered.scoring.thresholds;
  const read = (avr: ReadonlyMap<Dimension, number>): JudgeWeightedRuleReading => {
    const ahs = weightedAhs(weights, avr);
    return { ahs, verdict: determineVerdict(ahs as AHSScore, thresholds) };
  };
  const regAvr = avrMapOf(registered);
  const blindAvr = new Map([...regAvr].map(([d, a]) => [d, JUDGE_DIMENSIONS.includes(d) ? 0 : a] as const));
  const rules: Partial<Record<JwRule, JudgeWeightedRuleReading>> = { registered: read(regAvr) };
  if (variant !== undefined && num(variant.ahsCombined) !== undefined) rules.proportional = read(avrMapOf(variant));
  if (anyFailAvr !== undefined) rules.any_fail = read(anyFailAvr);
  const wNeural = [...weights].filter(([d]) => JUDGE_DIMENSIONS.includes(d)).reduce((a, [, w]) => a + w, 0);
  return { wNeural, judgeBlind: read(blindAvr), rules };
}

/** `post-hoc` when the registered run predates the `judge-weighted-v1` registration (prereg v17), else `pre-registered`. */
export function judgeWeightedReadingOf(record: RunRecord): 'post-hoc' | 'pre-registered' {
  return record.preregVersion < JUDGE_WEIGHTED_PREREG_VERSION ? 'post-hoc' : 'pre-registered';
}

/** `post-hoc` when the registered run predates the ADR-028 registration (prereg v14), else `pre-registered`. */
export function readingOf(record: RunRecord): 'post-hoc' | 'pre-registered' {
  return record.preregVersion < ADR028_PREREG_VERSION ? 'post-hoc' : 'pre-registered';
}

// ---------------------------------------------------------------------------------------------

export interface ComparisonRow {
  readonly projectId: string;
  readonly registered: Run;
  readonly variant: Run;
  readonly reading: 'post-hoc' | 'pre-registered';
  readonly verdictRulesOnly: string;
  readonly verdictChanged: boolean;
  readonly sameJudgeUnits: boolean;
  readonly decomposition?: JudgeDecomposition;
  readonly anyFail: AnyFailReading;
  readonly judgeWeighted?: JudgeWeightedReading;
}

export function pairRuns(registered: readonly Run[], variant: readonly Run[], readingOverride?: string): ComparisonRow[] {
  const key = (r: Run): string => `${r.record.projectId}\u0000${r.record.specSha}`;
  const byKey = new Map(variant.map((v) => [key(v), v] as const));
  if (registered.length === 0) throw new Error(`${COMPARE_INPUT_INVALID}: no accepted registered run`);
  const out: ComparisonRow[] = [];
  for (const reg of registered) {
    const v = byKey.get(key(reg));
    if (v === undefined) throw new Error(`${COMPARE_INPUT_INVALID}: no accepted variant run for ${reg.record.projectId}`);
    if (ruleOf(reg.report) !== 'registered') throw new Error(`${COMPARE_INPUT_INVALID}: ${reg.record.runId} is not a registered-rule report`);
    if (ruleOf(v.report) !== 'proportional') throw new Error(`${COMPARE_INPUT_INVALID}: ${v.record.runId} is not a proportional-rule report`);
    if (f3(num(reg.report.ahsDeterministic)) !== f3(num(v.report.ahsDeterministic))) {
      throw new Error(`${COMPARE_INPUT_INVALID}: ${reg.record.projectId} rules-only AHS differs (${f3(num(reg.report.ahsDeterministic))} vs ${f3(num(v.report.ahsDeterministic))})`);
    }
    const reading = readingOf(reg.record);
    if (readingOverride !== undefined && readingOverride !== reading) {
      throw new Error(`${COMPARE_INPUT_INVALID}: --reading ${readingOverride} contradicts ${reg.record.runId} (preregVersion ${String(reg.record.preregVersion)} → ${reading})`);
    }
    const det = num(reg.report.ahsDeterministic);
    const decomposition = judgeDecomposition(reg.report);
    const anyFail = anyFailReading(reg.report);
    const judgeWeighted = judgeWeightedReading(reg.report, v.report, anyFail.avr);
    out.push({
      projectId: reg.record.projectId, registered: reg, variant: v, reading,
      verdictRulesOnly: det === undefined ? '' : determineVerdict(det as AHSScore, reg.report.scoring.thresholds),
      verdictChanged: reg.report.verdict !== v.report.verdict,
      sameJudgeUnits: unitRowsOf(reg.report) === unitRowsOf(v.report),
      ...(decomposition !== undefined && { decomposition }),
      anyFail,
      ...(judgeWeighted !== undefined && { judgeWeighted }),
    });
  }
  if (variant.length !== registered.length) throw new Error(`${COMPARE_INPUT_INVALID}: ${String(variant.length)} variant runs for ${String(registered.length)} registered runs`);
  return out.sort((a, b) => cmp(a.projectId, b.projectId));
}

export function comparisonCsv(rows: readonly ComparisonRow[]): string {
  return csvText(COMPARISON_COLUMNS, rows.map((c) => {
    const r = c.registered.report;
    const v = c.variant.report;
    const d = c.decomposition;
    const delta = (a: unknown, b: unknown): number | undefined => (num(a) === undefined || num(b) === undefined ? undefined : (num(b) ?? 0) - (num(a) ?? 0));
    const propDeltaJudge = d === undefined || num(v.ahsCombined) === undefined ? undefined : (num(v.ahsCombined) ?? 0) - d.ahsCombinedJudgeBlind;
    return [
      c.projectId, c.registered.record.runId, c.variant.record.runId, r.evaluationMode, c.reading,
      String(c.registered.record.preregVersion), String(c.variant.record.preregVersion),
      f3(num(r.ahsDeterministic)), c.verdictRulesOnly,
      f3(num(r.ahsCombined)), f3(num(v.ahsCombined)), f3(delta(r.ahsCombined, v.ahsCombined)),
      f3(num(r.ahsNeuronal)), f3(num(v.ahsNeuronal)), f3(delta(r.ahsNeuronal, v.ahsNeuronal)),
      f3(avrOf(r, 'semantic')), f3(avrOf(v, 'semantic')), f3(avrOf(r, 'integrity')), f3(avrOf(v, 'integrity')),
      r.verdict, v.verdict, String(c.verdictChanged), String(c.sameJudgeUnits),
      f3(d?.wNeural), f3(d === undefined ? undefined : -d.wNeural), f3(d?.ahsCombinedJudgeBlind), d?.verdictJudgeBlind ?? '',
      f3(d?.deltaDilution), f3(d?.dilutionIdentity), f3(d?.deltaJudge), f3(propDeltaJudge),
      d === undefined ? '' : String(d.verdictJudgeBlind !== r.verdict), d === undefined ? '' : String(d.verdictJudgeBlind !== v.verdict),
      f3(c.anyFail.ahs), c.anyFail.verdict, String(c.anyFail.verdict !== '' && c.anyFail.verdict !== r.verdict),
      ...judgeWeightedCells(c),
    ];
  }));
}

/** The registered-weights AHS and verdict of each rule, the baseline of `delta_jw_<rule>`. */
function registeredWeightsOf(c: ComparisonRow, rule: JwRule): { readonly ahs?: number | undefined; readonly verdict: string } {
  switch (rule) {
    case 'registered':
      return { ahs: num(c.registered.report.ahsCombined), verdict: c.registered.report.verdict };
    case 'proportional':
      return { ahs: num(c.variant.report.ahsCombined), verdict: c.variant.report.verdict };
    case 'any_fail':
      return c.anyFail;
  }
}

function judgeWeightedCells(c: ComparisonRow): string[] {
  const j = c.judgeWeighted;
  const head = [
    judgeWeightedReadingOf(c.registered.record), f3(j?.wNeural), f3(j === undefined ? undefined : -j.wNeural),
    f3(j?.judgeBlind.ahs), j?.judgeBlind.verdict ?? '',
  ];
  return [...head, ...JW_RULES.flatMap((rule) => {
    const x = j?.rules[rule];
    if (j === undefined || x === undefined) return ['', '', '', '', '', ''];
    const base = registeredWeightsOf(c, rule);
    return [
      f3(x.ahs), x.verdict, f3(base.ahs === undefined ? undefined : x.ahs - base.ahs), String(base.verdict !== '' && x.verdict !== base.verdict),
      f3(x.ahs - j.judgeBlind.ahs), String(x.verdict !== j.judgeBlind.verdict),
    ];
  })];
}

/** One row per judged function of the variant report (it carries `candidatesByLayer`). */
export function contributionsCsv(rows: readonly ComparisonRow[]): string {
  const out: string[][] = [];
  for (const c of rows) {
    const report = c.variant.report;
    const thresholds = report.scoring.confidenceThresholds;
    for (const row of [...(report.neuralResults ?? [])].sort((a, b) => cmp(String(a.functionId), String(b.functionId)))) {
      out.push(contributionRow(c.projectId, row, thresholds));
    }
  }
  return csvText(CONTRIBUTION_COLUMNS, out);
}

function contributionRow(projectId: string, row: NeuralResultRow, thresholds: EvaluationReport['scoring']['confidenceThresholds']): string[] {
  const majority = aggregateUnits(row.unitResults, 'majority');
  const registered = majority === undefined ? undefined
    : majority.verdict === 'fail' ? confidenceWeight(majority.confidence, majority.flaggedUnstable, thresholds) : 0;
  const p = proportionalShare(row.unitResults, row.candidatesByLayer, thresholds);
  return [
    projectId, String(row.functionId), row.dimension, majority?.verdict ?? '', f6(registered), f6(p?.share), f6(p?.confidenceFreeShare),
    String(row.unitsSelected), String(p?.validUnits ?? 0), String(p?.failedUnits ?? 0), String(p?.warningUnits ?? 0), String(row.candidateCount),
    (p?.strata ?? []).map((s) => `${s.layer}:${String(s.candidates)}/${String(s.validUnits)}/${String(s.failedUnits)}`).join(';'),
  ];
}

export interface CompareSummary {
  readonly projects: number;
  readonly verdictChanges: number;
  readonly anyFailChanges: number;
  readonly judgeMattered: number;
  readonly deltaCombined: { readonly mean: number; readonly min: number; readonly max: number };
  readonly allSameJudgeUnits: boolean;
  /** `judge-weighted-v1`, per rule: verdicts moved by the reweighting, and verdicts the judge moves under it. */
  readonly judgeWeighted: Readonly<Record<JwRule, { readonly verdictChanges: number; readonly judgeMattered: number }>>;
}

export function summarise(rows: readonly ComparisonRow[]): CompareSummary {
  const deltas = rows.map((c) => (num(c.variant.report.ahsCombined) ?? 0) - (num(c.registered.report.ahsCombined) ?? 0));
  return {
    projects: rows.length,
    verdictChanges: rows.filter((c) => c.verdictChanged).length,
    anyFailChanges: rows.filter((c) => c.anyFail.verdict !== '' && c.anyFail.verdict !== c.registered.report.verdict).length,
    judgeMattered: rows.filter((c) => c.decomposition !== undefined && c.decomposition.verdictJudgeBlind !== c.registered.report.verdict).length,
    deltaCombined: {
      mean: deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length),
      min: Math.min(...deltas),
      max: Math.max(...deltas),
    },
    allSameJudgeUnits: rows.every((c) => c.sameJudgeUnits),
    judgeWeighted: Object.fromEntries(JW_RULES.map((rule) => {
      const read = rows.flatMap((c) => {
        const x = c.judgeWeighted?.rules[rule];
        return c.judgeWeighted === undefined || x === undefined ? [] : [{ c, x, blind: c.judgeWeighted.judgeBlind }];
      });
      return [rule, {
        verdictChanges: read.filter(({ c, x }) => x.verdict !== registeredWeightsOf(c, rule).verdict).length,
        judgeMattered: read.filter(({ x, blind }) => x.verdict !== blind.verdict).length,
      }] as const;
    })) as Record<JwRule, { verdictChanges: number; judgeMattered: number }>,
  };
}

export const COMPARE_USAGE = [
  'Usage: npx tsx scripts/compare-aggregations-cli.ts --registered <run dir> --variant <run dir> --out <dir> [--reading post-hoc|pre-registered]',
  '         (--reading is derived from the registered runs\' preregVersion; a contradicting value is refused)',
  '       npx tsx scripts/compare-aggregations-cli.ts --self-test',
].join('\n');

export interface CompareMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export function main(argv: readonly string[], repoRoot: string, io: CompareMainIo): number {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--self-test') {
      main(['--registered', join(repoRoot, 'does-not-exist'), '--variant', join(repoRoot, 'does-not-exist'), '--out', join(repoRoot, 'does-not-exist-out')], repoRoot, io);
      return 1;
    }
    const v = argv[i + 1];
    if (a.startsWith('--') && v !== undefined) {
      opts.set(a.slice(2), v);
      i++;
    } else {
      io.err(`${COMPARE_USAGE}\n`);
      return 2;
    }
  }
  const reg = opts.get('registered');
  const variant = opts.get('variant');
  const out = opts.get('out');
  const reading = opts.get('reading');
  if (reg === undefined || variant === undefined || out === undefined || (reading !== undefined && reading !== 'post-hoc' && reading !== 'pre-registered')) {
    io.err(`${COMPARE_USAGE}\n`);
    return 2;
  }
  try {
    const rows = pairRuns(acceptedRuns(resolve(repoRoot, reg)), acceptedRuns(resolve(repoRoot, variant)), reading);
    io.writeFile(join(resolve(repoRoot, out), 'ahs_by_aggregation.csv'), comparisonCsv(rows));
    io.writeFile(join(resolve(repoRoot, out), 'neural_contributions.csv'), contributionsCsv(rows));
    const s = summarise(rows);
    io.out(`${String(s.projects)} projects; proportional verdict changes ${String(s.verdictChanges)}; any-fail verdict changes ${String(s.anyFailChanges)}; `
      + `judge mattered (registered) ${String(s.judgeMattered)}; delta ahsCombined mean ${s.deltaCombined.mean.toFixed(3)} `
      + `(min ${s.deltaCombined.min.toFixed(3)}, max ${s.deltaCombined.max.toFixed(3)}); same judge units ${String(s.allSameJudgeUnits)}\n`);
    io.out(`${JUDGE_WEIGHTED_VARIANT} (judge weight 2/7): ${JW_RULES.map((rule) => `${rule} verdict changes ${String(s.judgeWeighted[rule].verdictChanges)}, `
      + `judge mattered ${String(s.judgeWeighted[rule].judgeMattered)}`).join('; ')}\n`);
    return s.allSameJudgeUnits ? 0 : 1;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
