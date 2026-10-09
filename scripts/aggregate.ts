/**
 * Aggregation to the CSV set and figures (FR-36; BR-U5b-30, 56, 61..65, 72, 78; U5b domain-entities §10).
 *
 * `aggregate` turns one harness output directory (`runs/*.run.json`, `reports/*.json`) plus the optional scorer output
 * (canonical `GoldenScore`), SP-* sensitivity results, reconciled labels and the manifest into the CSV set of
 * domain-entities §10. Every float is written with `toFixed(6)`; every RNG use takes a seed from the plan (bootstrap,
 * permutation); two runs over the same inputs give the same bytes (BR-U5b-63).
 *
 * - P/R/F1 files carry the common columns. Recall intervals (ADR-020 item 3) take the (project, operator) cell as the
 *   unit: `ci_low` / `ci_high` / `ci_method` / `n_clusters` are the cell interval (cell bootstrap from 10 cells, Wilson
 *   on the cell count below), `ci_project_*` the project cluster bootstrap (co-primary from 10 projects,
 *   `ci_project_descriptive = true` with 2..9 projects) and `ci_independent_*` the instance Wilson interval, the bound that holds only if the copies were independent; counts only below n = 10.
 *   The precision columns are the seeded differential precision; the SO4 baseline precision (ADR-020 item 1, the HT
 *   share of TP-class P2 labels) is `precision_baseline` beside it and has its own file `precision_baseline.csv`;
 *   `precision_figure.csv` holds both in figure-ready long form. Neural new violations are the `neural_new` column
 *   (MAT-19 1.1.0, ADR-020 item 5). Corpus-tier strata (`corpus-core`, `corpus-e7`) come from the score (item 8).
 * - SO5 (BR-U5b-64, 65): `so5_grid.csv` has one row per E1 cell including `not-run` (GEN code, flags), the AHS fields,
 *   per-dimension AVR and the weighted FPAT family counts (from the `Docs/analysis-plan.md` table only: violations
 *   labelled `TP` or `unseeded-TP` weigh the inverse of their P3 inclusion probability (ADR-020 item 2), failing judge
 *   units by dimension; nothing else counts). `so5_tests.csv`: permutation tests of the model and spec-level main
 *   effects and their interaction on the verdict-source AHS, task as block, Holm across the three; `ahsDeterministic`
 *   co-primary for the model effect (ADR-020 item 7); pairwise mean differences with bootstrap CIs (runs resampled
 *   within cells; descriptive only, ADR-020 item 6) and Cliff's δ; the pre-registered directional self-preference
 *   check; secondary outcomes Holm-corrected within their own family and marked exploratory.
 * - Files whose inputs come from the labeller (`fp_fn_taxonomy`, `agreement`, `audit_allocation`, `label_budget`) are
 *   the `llm-label.ts` tables of the `--labelling` outputs (header only when none are given).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvaluationReport } from '../src/shared/types/evaluation.js';
import { drawFigures } from './lib/figures/draw.js';
import { loadManifest } from './lib/manifest.js';
import { loadRunDir as loadRunDirOf } from './lib/report-io.js';
import type { GenerationCell, LoadedRunDir, RunRecord } from './lib/report-io.js';
import { ANALYSIS_PLAN_DOC, cellGenCode, familyOf, FPAT_FAMILIES, JOIN_GEN_CODES, loadSo5Codes } from './lib/so5-codes.js';
import { completeE1Cells, e1ProjectId } from './lib/e1-cells.js';
import type { FpatFamily, So5Codes } from './lib/so5-codes.js';
import { baselineLabelsOf, baselinePrecision, isTpClass } from './lib/baseline-precision.js';
import type { BaselinePrecisionRow } from './lib/baseline-precision.js';
import type { CorpusTier } from './lib/mutation/types.js';
import {
  cliffsDelta, createRng, holm, permutationFactorTest, permutationInteractionTest, permutationTest, proportionInterval, recallIntervals,
} from './lib/stats.js';
import type { RecallCell } from './lib/stats.js';
import { ablationCsv, rescoreReport, sensitivityCsv } from './rescore.js';
import type { RescoreOutput } from './rescore.js';
import { cycleQueryTimes, latencyGate, runIdOf } from './run-experiment.js';
import type { ExperimentPlan } from './run-experiment.js';
import { DATA_FLOW_SUB_ROW, DATA_FLOW_TEMPLATE, denominatorRow, readCorpusTiers, strataOf } from './score-golden.js';
import type { DenominatorRow, EdgeEvidence, FunctionSensitivityResult, InstanceResult, JudgeProbeResult } from './score-golden.js';
import { labellingTables } from './llm-label.js';
import { fnCauseColumns, fpatLabelsOf, isReconciledLabels } from './lib/label-adapters.js';
import type { LabellingOutputs } from './llm-label.js';

export const AGGREGATE_INPUT_INVALID = 'AGGREGATE_INPUT_INVALID';

/** domain-entities §10, in file order. */
export const CSV_FILES = [
  'prf_by_function.csv', 'prf_by_dimension.csv', 'prf_by_tag.csv', 'prf_overall.csv', 'prf_by_project.csv',
  'precision_baseline.csv', 'precision_figure.csv', 'instances.csv', 'twins.csv', 'edge_evidence.csv', 'judge_probe.csv', 'fp_fn_taxonomy.csv', 'denominators.csv',
  'latency.csv', 'coverage.csv', 'ahs_by_project.csv', 'rescore_ablation.csv', 'rescore_sensitivity.csv',
  'function_sensitivity.csv', 'so5_grid.csv', 'so5_patterns.csv', 'so5_tests.csv', 'agreement.csv',
  'audit_allocation.csv', 'label_budget.csv', 'runs.csv',
] as const;
export type CsvFile = (typeof CSV_FILES)[number];

export const DIMENSION_COLUMNS = ['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity'] as const;
export const COMMON_PRF_COLUMNS = [
  'plan_id', 'split', 'base_kind', 'coverage', 'tp', 'fp_strict', 'fp_labelled', 'fp_uncertain', 'fn', 'precision_strict',
  'precision_labelled', 'precision_incl_twins', 'recall', 'f1_labelled', 'ci_low', 'ci_high', 'ci_method', 'n_clusters',
  'ci_project_low', 'ci_project_high', 'ci_project_method', 'n_projects', 'ci_project_descriptive', 'ci_independent_low', 'ci_independent_high', 'ci_independent_method',
] as const;
export const BASELINE_PRECISION_COLUMNS = [
  'plan_id', 'scope', 'key', 'n_items', 'n_tp_class', 'n_uncertain', 'weighted_tp_class', 'weighted_total', 'n_effective',
  'precision_baseline', 'ci_low', 'ci_high', 'ci_method', 'n_clusters',
] as const;
export const PRECISION_FIGURE_COLUMNS = ['plan_id', 'scope', 'function_id', 'measure', 'estimate', 'ci_low', 'ci_high', 'ci_method', 'n'] as const;

// ---------------------------------------------------------------------------------------------
// CSV primitives (BR-U5b-63)

export const f6 = (x: number | null | undefined): string => (x === null || x === undefined || !Number.isFinite(x) ? '' : x.toFixed(6));
const int = (x: number | null | undefined): string => (x === null || x === undefined ? '' : String(x));
const bool = (x: boolean | null | undefined): string => (x === null || x === undefined ? '' : String(x));

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------
// Inputs

interface PrfJson { readonly tp: number; readonly fp: number; readonly fn: number; readonly precision: number | null; readonly recall: number | null; readonly f1: number | null }
interface PrfModesJson { readonly strict: PrfJson; readonly labelled: PrfJson | null; readonly inclTwins: PrfJson | null; readonly fpUncertain: number }
type Pairs<V> = readonly (readonly [string, V])[];

/** The canonical `GoldenScore` as `score-golden` writes it (maps as sorted key/value pair lists). */
export interface GoldenScoreJson {
  readonly ruleVersion: string;
  readonly perInstance: readonly InstanceResult[];
  readonly perFunction: Pairs<Pairs<PrfModesJson>>;
  readonly perDimension: Pairs<Pairs<PrfModesJson>>;
  readonly perTag: Pairs<Pairs<PrfModesJson>>;
  readonly overall: Pairs<PrfModesJson>;
  readonly collateralByFunction: Pairs<number>;
  /** MAT-19 1.1.0; absent in scores written before ADR-020. */
  readonly neuralNewByFunction?: Pairs<number>;
  readonly notApplicable: Pairs<number>;
  readonly metricKeyExclusions: Pairs<number>;
  readonly twinSpecificity: { readonly clean: number; readonly scored: number };
  readonly edgeEvidence: readonly EdgeEvidence[];
  readonly judgeProbe: readonly JudgeProbeResult[];
  readonly denominators: readonly DenominatorRow[];
}

/** A reconciled label of one new violation in an E1 cell (P3 population; BR-U5b-64 FPAT counting). */
export interface LabelledViolation {
  readonly runId: string;
  readonly functionId: string;
  readonly label: 'TP' | 'unseeded-TP' | 'FP' | 'uncertain';
  /** P3 inclusion probability of a TP-class label (weight = 1 / p, ADR-020 item 2); 1 when absent. */
  readonly inclusionProbability?: number;
}

export interface AggregateInput {
  readonly planId: string;
  readonly plan?: ExperimentPlan;
  readonly records: readonly RunRecord[];
  /** Stored reports by `runId` of the record. */
  readonly reports: ReadonlyMap<string, EvaluationReport>;
  readonly so5: So5Codes;
  readonly score?: GoldenScoreJson;
  readonly sensitivity?: readonly FunctionSensitivityResult[];
  readonly labels?: readonly LabelledViolation[];
  /** Labeller outputs (plan strata, reconciled labels, FN causes, audit allocation, agreement) for the four labeller files. */
  readonly labelling?: LabellingOutputs;
  /** Seed id → twin-of seed id (from the manifest). */
  readonly twinOf?: ReadonlyMap<string, string>;
  /** Corpus project id → tier, for the baseline-precision tier rows (ADR-020 item 8; `corpusTiers` of corpus.json). */
  readonly corpusTiers?: ReadonlyMap<string, CorpusTier>;
  /** Bootstrap and permutation resamples (default 10 000). */
  readonly resamples?: number;
}

// ---------------------------------------------------------------------------------------------
// P/R/F1 files

function stratumParts(key: string): [string, string, string] {
  const parsed = JSON.parse(key) as unknown;
  if (Array.isArray(parsed) && parsed.length === 3) return [String(parsed[0]), String(parsed[1]), String(parsed[2])];
  throw new Error(`${AGGREGATE_INPUT_INVALID}: stratum key ${key}`);
}

const counted = (i: InstanceResult): boolean => i.status === 'matched' || i.status === 'missed';

/**
 * (project, operator) recall cells of a stratum (ADR-020 item 3): `num` detected of `den` scored copies. `keep` selects
 * the instances of the row; `detected` decides TP (default: the instance is `matched`; per-function rows: the function
 * is in `detectedBy`).
 */
export function instanceCells(
  instances: readonly InstanceResult[],
  stratum: string,
  keep: (i: InstanceResult) => boolean = () => true,
  detected: (i: InstanceResult) => boolean = (i) => i.status === 'matched',
): RecallCell[] {
  const byCell = new Map<string, RecallCell & { num: number; den: number }>();
  for (const i of instances) {
    if (!counted(i) || !keep(i) || !strataOf(i).includes(stratum)) continue;
    const key = JSON.stringify([i.projectId, i.operatorId]);
    const c = byCell.get(key) ?? { project: i.projectId, operator: i.operatorId, num: 0, den: 0 };
    c.num += detected(i) ? 1 : 0;
    c.den += 1;
    byCell.set(key, c);
  }
  return [...byCell.keys()].sort().map((k) => byCell.get(k) ?? { project: '', operator: '', num: 0, den: 0 });
}

/**
 * The interval columns of a recall row (ADR-020 item 3). Cells must reproduce the row's counts; when they do not
 * (an older score without `applicable`, or a sub-row without template names), only the "if independent" instance
 * interval is written and the cell columns stay empty (DV-U5b-16).
 */
function ciCells(cells: readonly RecallCell[], tp: number, fn: number, seed: number, resamples: number): string[] {
  const sum = cells.reduce((a, c) => ({ num: a.num + c.num, den: a.den + c.den }), { num: 0, den: 0 });
  const reproduces = cells.length > 0 && sum.num === tp && sum.den === tp + fn;
  if (tp + fn === 0) return ['', '', '', int(cells.length), '', '', '', '', '', '', '', ''];
  const r = recallIntervals(reproduces ? cells : [{ project: '', operator: '', num: tp, den: tp + fn }], { seed, resamples });
  const cellCols = reproduces ? [f6(r.cell.ciLow), f6(r.cell.ciHigh), r.cell.ciMethod ?? '', int(r.nCells)] : ['', '', '', ''];
  const projectCols = reproduces
    ? [f6(r.project.ciLow), f6(r.project.ciHigh), r.project.ciMethod ?? '', int(r.nProjects), r.project.descriptive === null ? '' : String(r.project.descriptive)]
    : ['', '', '', '', ''];
  return [...cellCols, ...projectCols, f6(r.independent.ciLow), f6(r.independent.ciHigh), r.independent.ciMethod ?? ''];
}

function prfCells(planId: string, stratum: string, m: PrfModesJson, ci: string[]): string[] {
  const [split, baseKind, coverage] = stratumParts(stratum);
  return [
    planId, split, baseKind, coverage, int(m.strict.tp), int(m.strict.fp), int(m.labelled?.fp), int(m.fpUncertain), int(m.strict.fn),
    f6(m.strict.precision), f6(m.labelled?.precision), f6(m.inclTwins?.precision), f6(m.strict.recall), f6(m.labelled?.f1), ...ci,
  ];
}

interface FunctionMeta { readonly dimension: string; readonly tag: string; readonly name: string }

/** Function id → dimension, tag and template name, from the `functionResults` rows of the reports. */
export function functionMeta(reports: Iterable<EvaluationReport>): Map<string, FunctionMeta> {
  const meta = new Map<string, FunctionMeta>();
  for (const r of reports) {
    for (const row of r.functionResults) {
      const id = String(row.functionId);
      if (!meta.has(id)) meta.set(id, { dimension: row.dimension, tag: row.tag ?? '', name: row.name });
    }
  }
  return meta;
}

/** The SO4 baseline-precision rows of the labelling outputs (ADR-020 item 1); empty without P2 labels. */
export function baselineRows(input: AggregateInput, seed: number, resamples: number): BaselinePrecisionRow[] {
  const labels = baselineLabelsOf(input.labelling?.labels ?? []);
  const tiers = input.corpusTiers;
  return baselinePrecision(labels, { seed, resamples, ...(tiers !== undefined && { tierOf: (p: string) => tiers.get(p) }) });
}

/** Seeded differential precision rows of the figure (held-out total stratum; Wilson / CP on items, BR-U5b-61). */
function differentialFigureRows(pid: string, scope: 'overall' | 'function', fid: string, m: PrfModesJson, seed: number, resamples: number): string[][] {
  const rows: string[][] = [];
  for (const [measure, prf] of [['seeded-differential-labelled', m.labelled], ['seeded-differential-strict', m.strict]] as const) {
    if (prf === null) continue;
    const n = prf.tp + prf.fp;
    const cell = n === 0 ? undefined : proportionInterval([{ num: prf.tp, den: n }], { seed, resamples });
    rows.push([pid, scope, fid, measure, f6(prf.precision), f6(cell?.ciLow), f6(cell?.ciHigh), cell?.ciMethod ?? '', int(n)]);
  }
  return rows;
}

/** Stratum of the headline SO4 figure: the held-out total (BR-U5b-20). */
export const HEADLINE_STRATUM = JSON.stringify(['held-out', 'all', 'all']);

function prfFiles(input: AggregateInput, seed: number, resamples: number): Partial<Record<CsvFile, string>> {
  const s = input.score;
  const pid = input.planId;
  const meta = functionMeta(input.reports.values());
  const baseline = baselineRows(input, seed, resamples);
  const baselineOf = (scope: 'overall' | 'function', key: string): string => f6(baseline.find((b) => b.scope === scope && b.key === key)?.estimate);
  const out: Partial<Record<CsvFile, string>> = {};
  const fnRows: string[][] = [];
  const dimRows: string[][] = [];
  const tagRows: string[][] = [];
  const overallRows: string[][] = [];
  const projectRows: string[][] = [];
  if (s !== undefined) {
    const inst = s.perInstance;
    const na = new Map(s.notApplicable);
    const coll = new Map(s.collateralByFunction);
    const mke = new Map(s.metricKeyExclusions);
    const neural = new Map(s.neuralNewByFunction ?? []);
    const applicableOf = (i: InstanceResult): readonly string[] => (i as Partial<InstanceResult>).applicable ?? [];
    for (const [stratum, fns] of s.perFunction) {
      for (const [fid, m] of fns) {
        const md = meta.get(fid);
        const cells = instanceCells(inst, stratum, (i) => applicableOf(i).includes(fid), (i) => i.detectedBy.includes(fid));
        fnRows.push([...prfCells(pid, stratum, m, ciCells(cells, m.strict.tp, m.strict.fn, seed, resamples)), fid, md?.dimension ?? '', md?.tag ?? '', int(na.get(fid) ?? 0), int(coll.get(fid) ?? 0), int(mke.get(fid) ?? 0), int(neural.get(fid) ?? 0), baselineOf('function', fid)]);
      }
    }
    for (const [stratum, dims] of s.perDimension) {
      for (const [dim, m] of dims) dimRows.push([...prfCells(pid, stratum, m, ciCells(instanceCells(inst, stratum, (i) => i.dimension === dim), m.strict.tp, m.strict.fn, seed, resamples)), dim]);
    }
    for (const [stratum, tags] of s.perTag) {
      for (const [tag, m] of tags) {
        const sub = tag === DATA_FLOW_SUB_ROW;
        const base = sub ? DATA_FLOW_SUB_ROW.split('/')[0] ?? tag : tag;
        const cells = sub
          ? instanceCells(inst, stratum, (i) => i.tags.includes(base) && applicableOf(i).some((f) => meta.get(f)?.name === DATA_FLOW_TEMPLATE))
          : instanceCells(inst, stratum, (i) => i.tags.includes(tag));
        tagRows.push([...prfCells(pid, stratum, m, ciCells(cells, m.strict.tp, m.strict.fn, seed, resamples)), base, sub ? DATA_FLOW_SUB_ROW.split('/')[1] ?? '' : '']);
      }
    }
    const overall = new Map(s.overall);
    for (const [stratum, m] of s.overall) {
      const [split, baseKind] = stratumParts(stratum);
      const inCov = overall.get(JSON.stringify([split, baseKind, 'in']));
      const all = overall.get(JSON.stringify([split, baseKind, 'all']));
      overallRows.push([...prfCells(pid, stratum, m, ciCells(instanceCells(inst, stratum), m.strict.tp, m.strict.fn, seed, resamples)), f6(inCov?.strict.recall), f6(all?.strict.recall), baselineOf('overall', '')]);
    }
    for (const [stratum] of s.overall) {
      const projects = [...new Set(inst.filter((i) => strataOf(i).includes(stratum)).map((i) => i.projectId))].sort();
      for (const p of projects) {
        const rows = inst.filter((i) => i.projectId === p && strataOf(i).includes(stratum) && counted(i));
        const tp = rows.filter((i) => i.status === 'matched').length;
        const fn = rows.length - tp;
        const fp = rows.reduce((a, i) => a + i.undeclaredNew.length, 0);
        const m: PrfModesJson = {
          strict: { tp, fp, fn, precision: tp + fp === 0 ? null : tp / (tp + fp), recall: tp + fn === 0 ? null : tp / (tp + fn), f1: null },
          labelled: null, inclTwins: null, fpUncertain: 0,
        };
        projectRows.push([...prfCells(pid, stratum, m, ciCells(instanceCells(inst, stratum, (i) => i.projectId === p), tp, fn, seed, resamples)), p]);
      }
    }
  }
  out['prf_by_function.csv'] = csvText([...COMMON_PRF_COLUMNS, 'function_id', 'dimension', 'tag', 'not_applicable', 'collateral', 'metric_key_excluded', 'neural_new', 'precision_baseline'], fnRows);
  out['prf_by_dimension.csv'] = csvText([...COMMON_PRF_COLUMNS, 'dimension'], dimRows);
  out['prf_by_tag.csv'] = csvText([...COMMON_PRF_COLUMNS, 'tag', 'sub_row'], tagRows);
  out['prf_overall.csv'] = csvText([...COMMON_PRF_COLUMNS, 'recall_in_coverage', 'recall_overall', 'precision_baseline'], overallRows);
  out['prf_by_project.csv'] = csvText([...COMMON_PRF_COLUMNS, 'project_id'], projectRows);
  out['precision_baseline.csv'] = csvText(BASELINE_PRECISION_COLUMNS, baseline.map((b) => [
    pid, b.scope, b.key, int(b.n), int(b.nTpClass), int(b.nUncertain), f6(b.weightedTpClass), f6(b.weightedTotal), f6(b.nEffective),
    f6(b.estimate), f6(b.ciLow), f6(b.ciHigh), b.ciMethod ?? '', int(b.nClusters),
  ]));
  // Figure-ready long form (ADR-020 item 1): seeded differential precision (held-out total) beside baseline precision.
  const figure: string[][] = [];
  const headline = s === undefined ? undefined : new Map(s.overall).get(HEADLINE_STRATUM);
  const headlineFns = s === undefined ? undefined : new Map(new Map(s.perFunction).get(HEADLINE_STRATUM) ?? []);
  const baselineFigure = (b: BaselinePrecisionRow | undefined, scope: 'overall' | 'function', fid: string): string[][] => (b === undefined ? [] : [[pid, scope, fid, 'baseline', f6(b.estimate), f6(b.ciLow), f6(b.ciHigh), b.ciMethod ?? '', int(b.n)]]);
  if (headline !== undefined) figure.push(...differentialFigureRows(pid, 'overall', '', headline, seed, resamples));
  figure.push(...baselineFigure(baseline.find((b) => b.scope === 'overall'), 'overall', ''));
  const figureFns = [...new Set([...(headlineFns?.keys() ?? []), ...baseline.filter((b) => b.scope === 'function').map((b) => b.key)])].sort();
  for (const fid of figureFns) {
    const m = headlineFns?.get(fid);
    if (m !== undefined) figure.push(...differentialFigureRows(pid, 'function', fid, m, seed, resamples));
    figure.push(...baselineFigure(baseline.find((b) => b.scope === 'function' && b.key === fid), 'function', fid));
  }
  out['precision_figure.csv'] = csvText(PRECISION_FIGURE_COLUMNS, figure);

  const inst = s?.perInstance ?? [];
  out['instances.csv'] = csvText(
    ['seed_id', 'project_id', 'operator_id', 'status', 'detected_by', 'line_confirmed', 'collateral_keys', 'undeclared_new', 'fn_root_cause', 'fn_cause_source', 'corpus_tier'],
    inst.filter((i) => i.status !== 'twin-clean' && i.status !== 'twin-fired').map((i) => [
      i.seedId, i.projectId, i.operatorId, i.status, i.detectedBy.join(';'), bool(i.lineConfirmed), JSON.stringify(i.collateral), JSON.stringify(i.undeclaredNew),
      ...(i.status === 'missed' ? fnCauseColumns(i.seedId, input.labelling?.fnCauses ?? [], input.labelling?.labels ?? []) : ['', '']), i.corpusTier ?? '',
    ]),
  );
  const twins = inst.filter((i) => i.status === 'twin-clean' || i.status === 'twin-fired');
  const spec = s?.twinSpecificity;
  out['twins.csv'] = csvText(['seed_id', 'twin_of', 'status', 'undeclared_new'], [
    ...twins.map((i) => [i.seedId, input.twinOf?.get(i.seedId) ?? '', i.status, JSON.stringify(i.undeclaredNew)]),
    ...(spec === undefined ? [] : [['specificity', '', `${String(spec.clean)}/${String(spec.scored)}`, f6(spec.scored === 0 ? null : spec.clean / spec.scored)]]),
  ]);
  out['edge_evidence.csv'] = csvText(['seed_id', 'negative', 'edge_type', 'baseline', 'seeded', 'delta', 'declared', 'pass'],
    (s?.edgeEvidence ?? []).map((e) => [e.seedId, bool(e.negative), e.edgeType, int(e.baseline), int(e.seeded), int(e.delta), int(e.declared), bool(e.pass)]));
  out['judge_probe.csv'] = csvText(['seed_id', 'probe', 'negative', 'run_index', 'detected', 'in_selection', 'coverage_share'],
    (s?.judgeProbe ?? []).map((j) => [j.seedId, j.probe, bool(j.negative), int(j.runIndex), bool(j.detected), bool(j.inSelection), f6(j.coverageShare)]));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Run-level files

function acceptedReports(input: AggregateInput): { record: RunRecord; report: EvaluationReport }[] {
  return input.records.filter((r) => r.status === 'accepted').flatMap((record) => {
    const report = input.reports.get(record.runId);
    return report === undefined ? [] : [{ record, report }];
  });
}

const ahsOf = (r: EvaluationReport, field: 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal'): number | undefined => {
  const v = (r as unknown as Record<string, unknown>)[field];
  return typeof v === 'number' ? v : undefined;
};

function avrMap(r: EvaluationReport): Map<string, number> {
  return new Map<string, number>(r.perDimensionScores.map((d) => [d.dimension, Number(d.avr)]));
}

function verdictSourceOf(r: EvaluationReport): 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal' {
  const vs = (r.scoring as { verdictSource?: string } | undefined)?.verdictSource;
  if (vs === 'ahsCombined' || vs === 'ahsNeuronal' || vs === 'ahsDeterministic') return vs;
  return r.evaluationMode === 'full' ? 'ahsCombined' : r.evaluationMode === 'neuronal-only' ? 'ahsNeuronal' : 'ahsDeterministic';
}

function runFiles(input: AggregateInput): Partial<Record<CsvFile, string>> {
  const out: Partial<Record<CsvFile, string>> = {};
  const acc = acceptedReports(input);
  const denoms: DenominatorRow[] = input.score?.denominators !== undefined && input.score.denominators.length > 0
    ? [...input.score.denominators]
    : acc.map(({ record, report }) => denominatorRow(record.seed?.seedId ?? null, record.runId, report, 0, 0));
  out['denominators.csv'] = csvText(
    ['run_id', 'declared', 'adr_derived', 'compiled', 'disabled', 'dropped', 'dropped_ids', 'skipped_by_mode', 'executed', 'failed', 'not_applicable', 'metric_key_excluded', 'identity_ok'],
    denoms.map((d) => [d.runId, int(d.declared), int(d.adrDerived), int(d.compiled), int(d.disabled), int(d.dropped), d.droppedIds.join(';'), int(d.skippedByMode), int(d.executed), int(d.failed), int(d.notApplicable), int(d.metricKeyExcluded), bool(d.identityOk)]),
  );
  const latencyRows: string[][] = [];
  for (const { record, report } of acc) {
    const cycles = cycleQueryTimes(report);
    const timeout = report.functionExecution.failed.some((f) => f.code === 'EVAL_002');
    const gate = latencyGate(cycles, timeout);
    const stages = (report as unknown as { timings?: { stages?: { name: string; durationMs: number }[] } }).timings?.stages ?? [];
    const total = (report as unknown as { durationMs?: number }).durationMs;
    for (const st of stages.length > 0 ? stages : [{ name: '', durationMs: Number.NaN }]) {
      latencyRows.push([record.runId, record.projectId, int(report.parseCoverage.total), int(total), st.name, Number.isFinite(st.durationMs) ? int(st.durationMs) : '', int(cycles.reduce((a, b) => a + b, 0)), gate]);
    }
  }
  out['latency.csv'] = csvText(['run_id', 'project_id', 'file_count', 'total_ms', 'stage', 'stage_ms', 'cycle_query_ms', 'gate_result'], latencyRows);
  out['coverage.csv'] = csvText(
    ['run_id', 'parse_coverage', 'resolved_internal', 'external', 'external_out_of_root_alias', 'unresolved', 'dropped_no_file_node', 'unsupported_dynamic'],
    acc.map(({ record, report }) => {
      const ir = report.importResolution;
      return [record.runId, f6(report.parseCoverage.percentage / 100), int(ir.resolvedInternal), int(ir.external), int(ir.externalOutOfRootAlias), int(ir.unresolved), int(ir.droppedNoFileNode), int(ir.unsupportedDynamic)];
    }),
  );
  out['ahs_by_project.csv'] = csvText(
    ['run_id', 'project_id', 'evaluation_mode', 'ahs_deterministic', 'ahs_combined', 'ahs_neuronal', 'verdict_source', 'verdict', ...DIMENSION_COLUMNS.map((d) => `avr_${d}`), 'dropped_dimensions'],
    acc.map(({ record, report }) => {
      const avr = avrMap(report);
      return [
        record.runId, record.projectId, report.evaluationMode, f6(ahsOf(report, 'ahsDeterministic')), f6(ahsOf(report, 'ahsCombined')), f6(ahsOf(report, 'ahsNeuronal')),
        verdictSourceOf(report), report.verdict, ...DIMENSION_COLUMNS.map((d) => f6(avr.get(d))),
        report.droppedDimensions.map((d) => d.dimension).join(';'),
      ];
    }),
  );
  const rescored: RescoreOutput[] = [];
  for (const { record, report } of acc) {
    const r = rescoreReport(report);
    if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
    rescored.push({ ...r.value, runId: record.runId });
  }
  out['rescore_ablation.csv'] = ablationCsv(rescored);
  out['rescore_sensitivity.csv'] = sensitivityCsv(rescored);
  out['function_sensitivity.csv'] = csvText(['plan_id', 'probe_id', 'function_id', 'pass', 'line_confirmed', 'excluded_after_fail', 'fix_attempt_ref'],
    (input.sensitivity ?? []).map((p) => [input.planId, p.probeId, p.functionId, bool(p.pass), bool(p.lineConfirmed), bool(p.excludedAfterFail), p.fixAttemptRef ?? '']));
  out['runs.csv'] = csvText(
    ['run_id', 'plan_id', 'project_id', 'status', 'reason_code', 'reason_detail', 'attempt', 'report_path', 'spec_sha', 'cli_commit', 'prereg_version', 'frozen_hashes', 'env_record_id', 'started_at', 'wall_ms', 'cell', 'seed'],
    input.records.map((r) => [
      r.runId, r.planId, r.projectId, r.status, r.reasonCode ?? '', r.reasonDetail ?? '', int(r.attempt), r.reportPath ?? '', r.specSha, r.cliCommit,
      int(r.preregVersion), JSON.stringify(Object.fromEntries(Object.entries(r.frozenHashes).sort(([a], [b]) => (a < b ? -1 : 1)))), r.envRecordId, r.startedAt, int(r.wallMs),
      r.cell === undefined ? '' : JSON.stringify(r.cell), r.seed === undefined ? '' : JSON.stringify(r.seed),
    ]),
  );
  // Labeller-fed files (llm-label.ts tables; header only when no labelling outputs are given).
  const lt = labellingTables(input.labelling ?? {});
  for (const name of ['fp_fn_taxonomy.csv', 'agreement.csv', 'audit_allocation.csv', 'label_budget.csv'] as const) out[name] = csvText(lt[name].header, lt[name].rows);
  return out;
}

// ---------------------------------------------------------------------------------------------
// SO5 (BR-U5b-64, 65)

/** Weighted FPAT family counts of one cell (BR-U5b-64 as amended by ADR-020 item 2): TP-class labels weigh 1 / p; failing judge units 1. */
export function fpatCounts(runId: string, report: EvaluationReport | undefined, labels: readonly LabelledViolation[], so5: So5Codes): Map<FpatFamily, { count: number; weighted: number }> {
  const out = new Map<FpatFamily, { count: number; weighted: number }>();
  const add = (fam: FpatFamily | undefined, w: number): void => {
    if (fam === undefined) return;
    const c = out.get(fam) ?? { count: 0, weighted: 0 };
    c.count += 1;
    c.weighted += w;
    out.set(fam, c);
  };
  const names = new Map((report?.functionResults ?? []).map((r) => [String(r.functionId), r.name]));
  for (const l of labels) {
    if (l.runId !== runId || !isTpClass(l.label)) continue;
    // ADR-020 item 2: every TP-class label is weighted 1 / p (P3 seeds nothing, so TP and unseeded-TP are one class).
    const p = l.inclusionProbability ?? 1;
    if (!(p > 0 && p <= 1)) throw new Error(`${AGGREGATE_INPUT_INVALID}: inclusion probability ${String(p)} for ${l.functionId} in ${runId}`);
    add(familyOf(so5, names.get(l.functionId) ?? l.functionId), 1 / p);
  }
  for (const row of report?.neuralResults ?? []) {
    for (const u of row.unitResults) if (u.status === 'valid' && u.verdict === 'fail') add(familyOf(so5, row.dimension), 1);
  }
  return out;
}

export interface So5Cell {
  readonly record: RunRecord;
  readonly report?: EvaluationReport;
  readonly valid: boolean;
  readonly model: string;
  readonly specLevel: string;
  readonly taskId: string;
  readonly runIndex: number;
  readonly fpat: Map<FpatFamily, { count: number; weighted: number }>;
}

/**
 * The not-run record of an E1 grid coordinate that no RunRecord carries (ADR-021 SO5-05): a run that stopped before
 * the entry, or an older record without a `cell`. It exists only inside the SO5 outputs and is never written; its
 * `runId` is the one `run-experiment.ts` gives the entry (projects first, then the grid in coordinate order).
 */
export function missingE1Record(plan: ExperimentPlan, coordinateIndex: number, cell: GenerationCell): RunRecord {
  const projectId = e1ProjectId({ modelId: cell.requestedModelId, taskId: cell.taskId, specLevel: cell.specLevel, runIndex: cell.runIndex });
  const runId = runIdOf(plan.id, { index: plan.projects.length + coordinateIndex, projectId, path: '', specPath: '' });
  return {
    runId, planId: plan.id, projectId, status: 'not-run', reasonCode: 'generation-failed',
    reasonDetail: `${JOIN_GEN_CODES.missing}: no RunRecord for the grid coordinate`, attempt: 1,
    specSha: '', cliCommit: '', preregVersion: 0, frozenHashes: {}, envRecordId: '', startedAt: '', wallMs: 0, cell,
  };
}

/**
 * The records the SO5 outputs read. For a plan with an `e1` grid: one record per grid coordinate in coordinate order
 * (`completeE1Cells`; a coordinate no record carries gets `missingE1Record`), then the record cells that match no
 * coordinate, so nothing is dropped (analysis-plan §8). Otherwise every record with a `cell`.
 */
export function so5Records(input: AggregateInput): RunRecord[] {
  const withCell = input.records.filter((r) => r.cell !== undefined);
  const grid = input.plan?.e1;
  if (input.plan === undefined || grid === undefined) return withCell;
  const plan = input.plan;
  const byCell = new Map<GenerationCell, RunRecord>(withCell.flatMap((r) => (r.cell === undefined ? [] : [[r.cell, r] as const])));
  const complete = completeE1Cells(withCell, grid);
  const out = complete.cells.map((cell, i) => byCell.get(cell) ?? missingE1Record(plan, i, cell));
  for (const cell of complete.extra) {
    const r = byCell.get(cell);
    if (r !== undefined) out.push(r);
  }
  return out;
}

export function so5Cells(input: AggregateInput): So5Cell[] {
  return so5Records(input).map((record) => {
    const cell = record.cell;
    if (cell === undefined) throw new Error('unreachable');
    const report = record.status === 'accepted' ? input.reports.get(record.runId) : undefined;
    return {
      record, ...(report !== undefined && { report }), valid: report !== undefined,
      model: cell.requestedModelId, specLevel: cell.specLevel, taskId: cell.taskId, runIndex: cell.runIndex,
      fpat: fpatCounts(record.runId, report, input.labels ?? [], input.so5),
    };
  });
}

/** The primary SO5 outcome of a valid cell: the AHS field named by the report's `scoring.verdictSource` (BR-U5b-65). */
export function primaryOutcome(report: EvaluationReport): { field: string; value: number | undefined } {
  const field = verdictSourceOf(report);
  return { field, value: ahsOf(report, field) };
}

/** One SO5 outcome family; `confirmatory` lists the effects whose rows are confirmatory (the rest are exploratory). */
interface Outcome { readonly family: string; readonly confirmatory: readonly string[]; readonly values: (c: So5Cell) => number | undefined }

const ALL_EFFECTS = ['model', 'spec-level', 'model×spec-level'] as const;

function outcomesOf(cells: readonly So5Cell[]): Outcome[] {
  const valid = cells.filter((c) => c.report !== undefined);
  const first = valid[0]?.report;
  const primaryField = first === undefined ? 'ahsDeterministic' : verdictSourceOf(first);
  const outcomes: Outcome[] = [{ family: `primary:${primaryField}`, confirmatory: ALL_EFFECTS, values: (c) => (c.report === undefined ? undefined : primaryOutcome(c.report).value) }];
  for (const f of ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'] as const) {
    if (f === primaryField || !valid.some((c) => c.report !== undefined && ahsOf(c.report, f) !== undefined)) continue;
    // ADR-020 item 7: ahsDeterministic is co-primary for the model effect (its own Holm family of three).
    const coPrimary = f === 'ahsDeterministic';
    outcomes.push({ family: `${coPrimary ? 'co-primary' : 'secondary'}:${f}`, confirmatory: coPrimary ? ['model'] : [], values: (c) => (c.report === undefined ? undefined : ahsOf(c.report, f)) });
  }
  for (const d of DIMENSION_COLUMNS) {
    if (!valid.some((c) => c.report !== undefined && avrMap(c.report).has(d))) continue;
    outcomes.push({ family: `secondary:avr_${d}`, confirmatory: [], values: (c) => (c.report === undefined ? undefined : avrMap(c.report).get(d)) });
  }
  for (const fam of FPAT_FAMILIES) {
    if (!valid.some((c) => c.fpat.has(fam))) continue;
    outcomes.push({ family: `secondary:fpat_${fam}`, confirmatory: [], values: (c) => (c.valid ? (c.fpat.get(fam)?.weighted ?? 0) : undefined) });
  }
  outcomes.push({ family: 'secondary:valid_generation_yield', confirmatory: [], values: (c) => (c.valid ? 1 : 0) });
  if (valid.some((c) => (c.report?.neuralResults ?? []).length > 0)) {
    outcomes.push({
      family: 'secondary:judge_fail_share', confirmatory: [], values: (c) => {
        const units = (c.report?.neuralResults ?? []).flatMap((r) => r.unitResults).filter((u) => u.status === 'valid');
        return units.length === 0 ? undefined : units.filter((u) => u.verdict === 'fail').length / units.length;
      },
    });
  }
  return outcomes;
}

function stratifiedMeanDiffCi(obs: readonly { cell: string; group: 'A' | 'B'; value: number }[], seed: number, resamples: number): [number, number] {
  const rng = createRng(seed);
  const byCell = new Map<string, { group: 'A' | 'B'; values: number[] }>();
  for (const o of obs) {
    const c = byCell.get(o.cell) ?? { group: o.group, values: [] };
    c.values.push(o.value);
    byCell.set(o.cell, c);
  }
  const cells = [...byCell.keys()].sort().map((k) => byCell.get(k) ?? { group: 'A' as const, values: [] });
  const diffs: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sa = 0; let na = 0; let sb = 0; let nb = 0;
    for (const c of cells) {
      for (const _ of c.values) {
        const v = c.values[rng.int(c.values.length)] ?? 0;
        if (c.group === 'A') { sa += v; na++; } else { sb += v; nb++; }
      }
    }
    if (na > 0 && nb > 0) diffs.push(sa / na - sb / nb);
  }
  diffs.sort((a, b) => a - b);
  const q = (p: number): number => {
    if (diffs.length === 0) return Number.NaN;
    const h = (diffs.length - 1) * p;
    const lo = Math.floor(h);
    return (diffs[lo] ?? 0) + (h - lo) * ((diffs[Math.min(lo + 1, diffs.length - 1)] ?? 0) - (diffs[lo] ?? 0));
  };
  return [q(0.025), q(0.975)];
}

export const SO5_TEST_COLUMNS = ['effect', 'statistic', 'p_raw', 'p_holm', 'family', 'effect_size', 'ci_low', 'ci_high', 'cliffs_delta', 'exploratory', 'descriptive'] as const;

/** Family of the pre-registered directional self-preference check (ADR-020 item 7). */
export const DIRECTIONAL_FAMILY = 'directional:ahsNeuronal-minus-ahsDeterministic';

/**
 * The directional self-preference check (ADR-020 item 7): per valid cell d = ahsNeuronal − ahsDeterministic; the
 * statistic is mean(d | model = judge model) − mean(d | other models), tested one-sided (greater) by permutation of
 * the model labels within task, with Cliff's δ of the two d samples. `undefined` when either group is empty.
 */
export function directionalCheck(cells: readonly So5Cell[], judgeModel: string, seed: number, resamples: number): string[] | undefined {
  const obs = cells.flatMap((c) => {
    const n = c.report === undefined ? undefined : ahsOf(c.report, 'ahsNeuronal');
    const d = c.report === undefined ? undefined : ahsOf(c.report, 'ahsDeterministic');
    return n === undefined || d === undefined ? [] : [{ block: c.taskId, group: c.model === judgeModel ? 'A' as const : 'B' as const, value: n - d }];
  });
  const a = obs.filter((o) => o.group === 'A').map((o) => o.value);
  const b = obs.filter((o) => o.group === 'B').map((o) => o.value);
  if (a.length === 0 || b.length === 0) return undefined;
  const r = permutationTest(obs, { seed, resamples, alternative: 'greater' });
  return [`directional:${judgeModel}-vs-others`, f6(r.statistic), f6(r.p), f6(r.p), DIRECTIONAL_FAMILY, f6(r.statistic), '', '', f6(cliffsDelta(a, b)), 'false', 'false'];
}

/**
 * `so5_tests.csv` rows (BR-U5b-65 as amended by ADR-020 items 6, 7): the three permutation tests per outcome family,
 * the pairwise rows (mean difference with a bootstrap CI that is descriptive only, and Cliff's δ), and, when the
 * judge model is given, the directional self-preference check.
 */
export function so5Tests(cells: readonly So5Cell[], seeds: { readonly bootstrap: number; readonly permutation: number }, resamples: number, judgeModel?: string): string[][] {
  const rows: string[][] = [];
  for (const outcome of outcomesOf(cells)) {
    const obs = cells.flatMap((c) => {
      const v = outcome.values(c);
      return v === undefined || !Number.isFinite(v) ? [] : [{ c, v }];
    });
    const models = [...new Set(obs.map((o) => o.c.model))].sort();
    const levels = [...new Set(obs.map((o) => o.c.specLevel))].sort();
    if (models.length < 2 || levels.length < 2) continue;
    const opts = { seed: seeds.permutation, resamples };
    const tests = [
      { effect: 'model', r: permutationFactorTest(obs.map((o) => ({ block: o.c.taskId, level: o.c.model, value: o.v })), opts) },
      { effect: 'spec-level', r: permutationFactorTest(obs.map((o) => ({ block: o.c.taskId, level: o.c.specLevel, value: o.v })), opts) },
      { effect: 'model×spec-level', r: permutationInteractionTest(obs.map((o) => ({ block: o.c.taskId, a: o.c.model, b: o.c.specLevel, value: o.v })), opts) },
    ];
    const adjusted = holm(tests.map((t) => t.r.p));
    tests.forEach((t, i) => rows.push([t.effect, f6(t.r.statistic), f6(t.r.p), f6(adjusted[i]), outcome.family, '', '', '', '', String(!outcome.confirmatory.includes(t.effect)), 'false']));
    for (const [factor, list, key] of [['model', models, (c: So5Cell) => c.model], ['spec-level', levels, (c: So5Cell) => c.specLevel]] as const) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i] ?? '';
          const b = list[j] ?? '';
          const xa = obs.filter((o) => key(o.c) === a).map((o) => o.v);
          const xb = obs.filter((o) => key(o.c) === b).map((o) => o.v);
          if (xa.length === 0 || xb.length === 0) continue;
          const mean = (x: number[]): number => x.reduce((s, v) => s + v, 0) / x.length;
          const pair = obs.filter((o) => key(o.c) === a || key(o.c) === b).map((o) => ({
            cell: JSON.stringify([o.c.model, o.c.specLevel, o.c.taskId]), group: key(o.c) === a ? 'A' as const : 'B' as const, value: o.v,
          }));
          const [lo, hi] = stratifiedMeanDiffCi(pair, seeds.bootstrap, resamples);
          // ADR-020 item 6: the pairwise CI resamples three replicates within each cell and has no multiplicity
          // control, so it is descriptive only; inference rests on the Holm-corrected permutation p and Cliff's δ.
          rows.push([`${factor}:${a}-${b}`, '', '', '', outcome.family, f6(mean(xa) - mean(xb)), f6(lo), f6(hi), f6(cliffsDelta(xa, xb)), String(!outcome.confirmatory.includes(factor)), 'true']);
        }
      }
    }
  }
  if (judgeModel !== undefined) {
    const d = directionalCheck(cells, judgeModel, seeds.permutation, resamples);
    if (d !== undefined) rows.push(d);
  }
  return rows;
}

export function so5Csv(input: AggregateInput, resamples: number): Partial<Record<CsvFile, string>> {
  const cells = so5Cells(input);
  const cellCols = ['requested_model_id', 'resolved_model_id', 'adapter_id', 'prompt_template_id', 'style', 'spec_level', 'task_id', 'run_index', 'generation_outcome_path', 'generation_status', 'failure_reason', 'file_count', 'file_count_in_range', 'permission_denials'];
  const fpatCols = FPAT_FAMILIES.map((f) => `fpat_${f.slice('FPAT-'.length).toLowerCase().replace(/-/g, '_')}`);
  const grid = cells.map((c) => {
    const cell = c.record.cell;
    if (cell === undefined) throw new Error('unreachable');
    const r = c.report;
    const avr = r === undefined ? new Map<string, number>() : avrMap(r);
    return [
      cell.requestedModelId, cell.resolvedModelId ?? '', cell.adapterId, cell.promptTemplateId, cell.style, cell.specLevel, cell.taskId, int(cell.runIndex),
      cell.generationOutcomePath, cell.generationStatus, cell.failureReason ?? '', int(cell.fileCount), bool(cell.fileCountInRange), int(cell.permissionDenials),
      c.record.status, r === undefined ? '' : verdictSourceOf(r), f6(r === undefined ? undefined : ahsOf(r, 'ahsDeterministic')),
      f6(r === undefined ? undefined : ahsOf(r, 'ahsCombined')), f6(r === undefined ? undefined : ahsOf(r, 'ahsNeuronal')),
      ...DIMENSION_COLUMNS.map((d) => f6(avr.get(d))),
      ...FPAT_FAMILIES.map((f) => (c.valid ? f6(c.fpat.get(f)?.weighted ?? 0) : '')),
      cellGenCode(input.so5, cell) ?? '',
    ];
  });
  const patterns: string[][] = [];
  for (const c of cells) {
    for (const f of FPAT_FAMILIES) {
      const v = c.fpat.get(f);
      if (v !== undefined) patterns.push([c.record.runId, f, int(v.count), f6(v.weighted)]);
    }
    const cell = c.record.cell;
    const gen = cell === undefined ? undefined : cellGenCode(input.so5, cell);
    if (gen !== undefined) patterns.push([c.record.runId, gen, '1', f6(1)]);
  }
  const seeds = input.plan?.seeds ?? { sampling: 0, bootstrap: 0, permutation: 0 };
  return {
    'so5_grid.csv': csvText([...cellCols, 'status', 'verdict_source', 'ahs_deterministic', 'ahs_combined', 'ahs_neuronal', ...DIMENSION_COLUMNS.map((d) => `avr_${d}`), ...fpatCols, 'gen_code'], grid),
    'so5_patterns.csv': csvText(['run_id', 'code', 'count', 'weighted_count'], patterns),
    'so5_tests.csv': csvText(SO5_TEST_COLUMNS, so5Tests(cells, seeds, resamples, input.plan?.judge?.model)),
  };
}

// ---------------------------------------------------------------------------------------------
// Entry points

/** The full CSV set (domain-entities §10), keyed by file name, in `CSV_FILES` order. */
export function aggregate(input: AggregateInput): Map<CsvFile, string> {
  const resamples = input.resamples ?? 10_000;
  const seed = input.plan?.seeds.bootstrap ?? 0;
  const parts = { ...prfFiles(input, seed, resamples), ...runFiles(input), ...so5Csv(input, resamples) };
  return new Map(CSV_FILES.map((f) => {
    const text = parts[f];
    if (text === undefined) throw new Error(`aggregate: ${f} not produced`);
    return [f, text] as const;
  }));
}

export type { LoadedRunDir } from './lib/report-io.js';

/**
 * The FPAT input of `--labels` (ADR-021 SO5-01): the labeller's `ReconciledLabel[]` converted to P3 rows keyed by the
 * E1 run id (`label-adapters.ts`), or a `LabelledViolation[]` already in that shape. Refused
 * (`AGGREGATE_INPUT_INVALID`) instead of counting zeros: a label that matches no E1 record, and a labels file without
 * any P3 label while an accepted E1 report has symbolic violations.
 */
export function fpatLabelsFromFile(value: unknown, records: readonly RunRecord[], reports: ReadonlyMap<string, EvaluationReport>): LabelledViolation[] {
  let labels: LabelledViolation[];
  if (isReconciledLabels(value)) {
    const r = fpatLabelsOf(value, records);
    if (!r.ok) throw new Error(`${AGGREGATE_INPUT_INVALID}: ${r.detail}`);
    labels = r.labels;
  } else if (Array.isArray(value) && value.every((l) => typeof (l as Partial<LabelledViolation>).runId === 'string' && typeof (l as Partial<LabelledViolation>).functionId === 'string')) {
    labels = value as LabelledViolation[];
    const e1 = new Set(records.filter((r) => r.cell !== undefined).map((r) => r.runId));
    const stray = labels.find((l) => !e1.has(l.runId));
    if (stray !== undefined) throw new Error(`${AGGREGATE_INPUT_INVALID}: label of ${stray.functionId} names run ${stray.runId}, which is not an E1 record of --runs`);
  } else {
    throw new Error(`${AGGREGATE_INPUT_INVALID}: --labels must be llm-label output (ReconciledLabel[]) or LabelledViolation[]`);
  }
  const symbolic = records.some((r) => r.cell !== undefined && r.status === 'accepted'
    && (reports.get(r.runId)?.violations ?? []).some((v) => v.route !== 'neuronal' && (v as { readonly unitId?: unknown }).unitId === undefined));
  if (labels.length === 0 && symbolic) {
    throw new Error(`${AGGREGATE_INPUT_INVALID}: --labels holds no P3 label, but accepted E1 reports have symbolic violations; the FPAT columns would be 0`);
  }
  return labels;
}

/** Reads a harness output directory (`report-io.ts` `loadRunDir`, errors as `AGGREGATE_INPUT_INVALID`). */
export function loadRunDir(dir: string): LoadedRunDir {
  return loadRunDirOf(dir, AGGREGATE_INPUT_INVALID);
}

export const AGGREGATE_USAGE = [
  'Usage: npx tsx scripts/aggregate-cli.ts --runs <dir> --out <dir> [--plan <plan.json>] [--score <golden.json>]',
  '         [--manifest <manifest.json>] [--sensitivity <results.json>] [--labels <labels.json>] [--labelling <labelling.json>] [--resamples <n>] [--no-figures]',
  '       npx tsx scripts/aggregate-cli.ts --self-test',
].join('\n');

export interface AggregateMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export async function main(argv: readonly string[], repoRoot: string, io: AggregateMainIo): Promise<number> {
  const opts = new Map<string, string>();
  let figures = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--no-figures') figures = false;
    else if (a === '--self-test') {
      // Known-bad input: a run directory that does not exist.
      return main(['--runs', join(repoRoot, 'does-not-exist'), '--out', join(repoRoot, 'does-not-exist-out')], repoRoot, io).then(() => 1);
    } else if (a.startsWith('--') && argv[i + 1] !== undefined) opts.set(a.slice(2), argv[++i] ?? '');
    else {
      io.err(`${AGGREGATE_USAGE}\n`);
      return 2;
    }
  }
  const runs = opts.get('runs');
  const outDir = opts.get('out');
  if (runs === undefined || outDir === undefined) {
    io.err(`${AGGREGATE_USAGE}\n`);
    return 2;
  }
  try {
    const so5 = loadSo5Codes(repoRoot);
    if (!so5.ok) {
      io.err(`${so5.code}: ${so5.detail}\n`);
      return 1;
    }
    const { records, reports } = loadRunDir(resolve(repoRoot, runs));
    const planFile = opts.get('plan');
    const plan = planFile === undefined ? undefined : readJsonFile(resolve(repoRoot, planFile)) as ExperimentPlan;
    const manifestFile = opts.get('manifest');
    let twinOf: Map<string, string> | undefined;
    if (manifestFile !== undefined) {
      const m = loadManifest(repoRoot, resolve(repoRoot, manifestFile));
      if (!m.success) throw new Error(`${AGGREGATE_INPUT_INVALID}: ${m.errors.map((e) => e.message).join('; ')}`);
      twinOf = new Map(m.data.rows.flatMap((r) => ('twinOf' in r.expected && typeof r.expected.twinOf === 'string' ? [[r.seedId, r.expected.twinOf] as const] : [])));
    }
    const resamples = opts.get('resamples');
    const corpusTiers = readCorpusTiers(repoRoot);
    const input: AggregateInput = {
      planId: plan?.id ?? records[0]?.planId ?? 'unknown', ...(plan !== undefined && { plan }), records, reports, so5: so5.codes,
      ...(opts.has('score') && { score: readJsonFile(resolve(repoRoot, opts.get('score') ?? '')) as GoldenScoreJson }),
      ...(opts.has('sensitivity') && { sensitivity: readJsonFile(resolve(repoRoot, opts.get('sensitivity') ?? '')) as FunctionSensitivityResult[] }),
      ...(opts.has('labels') && { labels: fpatLabelsFromFile(readJsonFile(resolve(repoRoot, opts.get('labels') ?? '')), records, reports) }),
      ...(opts.has('labelling') && { labelling: readJsonFile(resolve(repoRoot, opts.get('labelling') ?? '')) as LabellingOutputs }),
      ...(twinOf !== undefined && { twinOf }),
      ...(corpusTiers !== undefined && { corpusTiers }),
      ...(resamples !== undefined && { resamples: Number(resamples) }),
    };
    const out = resolve(repoRoot, outDir);
    for (const [name, text] of aggregate(input)) io.writeFile(join(out, name), text);
    const svgs = figures ? await drawFigures(repoRoot, out, io.writeFile) : [];
    io.out(`${String(CSV_FILES.length)} CSV files and ${String(svgs.length)} SVG in ${out}\n`);
    return 0;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

export { ANALYSIS_PLAN_DOC };
