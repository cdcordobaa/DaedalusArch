/**
 * Registered vs proportional neural aggregation, per project (ADR-028; `Docs/analysis-plan.md` §12.3, §10 B9).
 *
 * Inputs: two harness output directories of the same plan, the registered reading (`--registered`, reports whose
 * `scoring.neuralAggregation` is `registered` or absent) and the variant reading (`--variant`, `proportional`), paired
 * by project id and spec sha. Refused (`COMPARE_INPUT_INVALID`) when a pair is missing, a report carries the wrong rule,
 * or the rules-only AHS of a pair differs (both readings come from the same code and the same judge calls).
 *
 * - `ahs_by_aggregation.csv`: per project the rules-only `ahsDeterministic` with the verdict its thresholds give,
 *   `ahsCombined` and `ahsNeuronal` under each rule with the difference, the Semantic and Integrity AVR under each rule,
 *   the verdict under each rule, `verdict_changed`, and `same_judge_units` (every judged unit row equal, the
 *   `candidatesByLayer` field aside). `reading` labels the rows (`post-hoc` for E7, `pre-registered` for E1).
 * - `neural_contributions.csv`: per project and judged function, the registered contribution (U4 majority verdict and
 *   the U3 confidence weight) and the proportional share with its strata (`layer:N_h/V_h/failed`).
 */
import { join, resolve } from 'node:path';
import type { EvaluationReport, NeuralResultRow } from '../src/shared/types/evaluation.js';
import type { AHSScore } from '../src/shared/types/value-objects.js';
import { confidenceWeight, proportionalShare } from '../src/scoring-engine/neural-aggregation.js';
import { determineVerdict } from '../src/scoring-engine/verdict.js';
import { loadRunDir } from './lib/report-io.js';
import type { RunRecord } from './lib/report-io.js';
import { aggregateUnits } from './rescore.js';

export const COMPARE_INPUT_INVALID = 'COMPARE_INPUT_INVALID';

export const COMPARISON_COLUMNS = [
  'project_id', 'registered_run_id', 'variant_run_id', 'evaluation_mode', 'reading', 'ahs_deterministic', 'verdict_rules_only',
  'ahs_combined_registered', 'ahs_combined_proportional', 'delta_combined', 'ahs_neuronal_registered', 'ahs_neuronal_proportional',
  'delta_neuronal', 'avr_semantic_registered', 'avr_semantic_proportional', 'avr_integrity_registered', 'avr_integrity_proportional',
  'verdict_registered', 'verdict_proportional', 'verdict_changed', 'same_judge_units',
] as const;
export const CONTRIBUTION_COLUMNS = [
  'project_id', 'function_id', 'dimension', 'majority_verdict', 'registered_contribution', 'proportional_share', 'units_selected',
  'units_valid', 'units_failed', 'units_split_vote', 'candidate_count', 'strata',
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

export interface ComparisonRow {
  readonly projectId: string;
  readonly registered: Run;
  readonly variant: Run;
  readonly verdictRulesOnly: string;
  readonly verdictChanged: boolean;
  readonly sameJudgeUnits: boolean;
}

export function pairRuns(registered: readonly Run[], variant: readonly Run[]): ComparisonRow[] {
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
    const det = num(reg.report.ahsDeterministic);
    out.push({
      projectId: reg.record.projectId, registered: reg, variant: v,
      verdictRulesOnly: det === undefined ? '' : determineVerdict(det as AHSScore, reg.report.scoring.thresholds),
      verdictChanged: reg.report.verdict !== v.report.verdict,
      sameJudgeUnits: unitRowsOf(reg.report) === unitRowsOf(v.report),
    });
  }
  if (variant.length !== registered.length) throw new Error(`${COMPARE_INPUT_INVALID}: ${String(variant.length)} variant runs for ${String(registered.length)} registered runs`);
  return out.sort((a, b) => cmp(a.projectId, b.projectId));
}

export function comparisonCsv(rows: readonly ComparisonRow[], reading: string): string {
  return csvText(COMPARISON_COLUMNS, rows.map((c) => {
    const r = c.registered.report;
    const v = c.variant.report;
    const delta = (a: unknown, b: unknown): number | undefined => (num(a) === undefined || num(b) === undefined ? undefined : (num(b) ?? 0) - (num(a) ?? 0));
    return [
      c.projectId, c.registered.record.runId, c.variant.record.runId, r.evaluationMode, reading, f3(num(r.ahsDeterministic)), c.verdictRulesOnly,
      f3(num(r.ahsCombined)), f3(num(v.ahsCombined)), f3(delta(r.ahsCombined, v.ahsCombined)),
      f3(num(r.ahsNeuronal)), f3(num(v.ahsNeuronal)), f3(delta(r.ahsNeuronal, v.ahsNeuronal)),
      f3(avrOf(r, 'semantic')), f3(avrOf(v, 'semantic')), f3(avrOf(r, 'integrity')), f3(avrOf(v, 'integrity')),
      r.verdict, v.verdict, String(c.verdictChanged), String(c.sameJudgeUnits),
    ];
  }));
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
    projectId, String(row.functionId), row.dimension, majority?.verdict ?? '', f6(registered), f6(p?.share), String(row.unitsSelected),
    String(p?.validUnits ?? 0), String(p?.failedUnits ?? 0), String(p?.warningUnits ?? 0), String(row.candidateCount),
    (p?.strata ?? []).map((s) => `${s.layer}:${String(s.candidates)}/${String(s.validUnits)}/${String(s.failedUnits)}`).join(';'),
  ];
}

export interface CompareSummary {
  readonly projects: number;
  readonly verdictChanges: number;
  readonly deltaCombined: { readonly mean: number; readonly min: number; readonly max: number };
  readonly allSameJudgeUnits: boolean;
}

export function summarise(rows: readonly ComparisonRow[]): CompareSummary {
  const deltas = rows.map((c) => (num(c.variant.report.ahsCombined) ?? 0) - (num(c.registered.report.ahsCombined) ?? 0));
  return {
    projects: rows.length,
    verdictChanges: rows.filter((c) => c.verdictChanged).length,
    deltaCombined: {
      mean: deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length),
      min: Math.min(...deltas),
      max: Math.max(...deltas),
    },
    allSameJudgeUnits: rows.every((c) => c.sameJudgeUnits),
  };
}

export const COMPARE_USAGE = [
  'Usage: npx tsx scripts/compare-aggregations-cli.ts --registered <run dir> --variant <run dir> --out <dir> [--reading post-hoc|pre-registered]',
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
  const reading = opts.get('reading') ?? 'pre-registered';
  if (reg === undefined || variant === undefined || out === undefined || (reading !== 'post-hoc' && reading !== 'pre-registered')) {
    io.err(`${COMPARE_USAGE}\n`);
    return 2;
  }
  try {
    const rows = pairRuns(acceptedRuns(resolve(repoRoot, reg)), acceptedRuns(resolve(repoRoot, variant)));
    io.writeFile(join(resolve(repoRoot, out), 'ahs_by_aggregation.csv'), comparisonCsv(rows, reading));
    io.writeFile(join(resolve(repoRoot, out), 'neural_contributions.csv'), contributionsCsv(rows));
    const s = summarise(rows);
    io.out(`${String(s.projects)} projects; verdict changes ${String(s.verdictChanges)}; delta ahsCombined mean ${s.deltaCombined.mean.toFixed(3)} `
      + `(min ${s.deltaCombined.min.toFixed(3)}, max ${s.deltaCombined.max.toFixed(3)}); same judge units ${String(s.allSameJudgeUnits)}\n`);
    return s.allSameJudgeUnits ? 0 : 1;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
