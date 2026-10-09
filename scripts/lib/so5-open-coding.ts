/**
 * Input of the exploratory open coding of E1 failure patterns (ADR-021 SO5-07; Fable B4; registered in
 * `Docs/analysis-plan.md` §6 "Exploratory open coding" by P-U6). Exploratory only: never a confirmatory outcome.
 *
 * Procedure (the analysis plan is the source; this module prepares step 1):
 * 1. The coding items are the reconciled labeller items of E1 runs whose label says a violation is present: P3
 *    violations labelled `TP` or `unseeded-TP` and P4 judge units labelled `fail`. `uncertain`, `FP`, `pass` and every
 *    non-E1 item (fixtures, corpus) are left out. Each item gives its rule (the function's template name, else its id),
 *    its kind and the non-empty rationales of the labeller's two runs.
 * 2. The items are blind to the E1 condition: model, spec level, task, run, project, run and item ids are not in the
 *    coding input. Inside the rationales, every E1 model id (requested and resolved), task id and spec level of
 *    `--runs` (except the level `none`, an ordinary word) and the item's own run and project ids are replaced by
 *    `[redacted]`. The order is a seeded shuffle (`OPEN_CODING_SEED`) of the items sorted by item id, and the
 *    coding ids `OC-0001…` follow that order, so neither order nor id reveals a cell.
 * 3. The key (coding id → item, run, cell, rule, FPAT family, weight 1 / p) is a separate file for the author, who
 *    consolidates the panel's proposed codes and is declared non-blind.
 *
 * Pure functions only.
 */
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import type { GenerationCell, RunRecord } from './report-io.js';
import { familyOf } from './so5-codes.js';
import type { So5Codes } from './so5-codes.js';
import { createRng, shuffle } from './stats.js';

export const OPEN_CODING_INPUT_INVALID = 'OPEN_CODING_INPUT_INVALID';
/** Seed of the item order (registered with the procedure in `Docs/analysis-plan.md` §6). */
export const OPEN_CODING_SEED = 6104;
export const OPEN_CODING_VERSION = '1.0.0';
export const REDACTED = '[redacted]';

/** The reconciled-label fields read here (`ReconciledLabel` of `scripts/llm-label.ts`). */
export interface CodingLabelView {
  readonly itemId: string;
  readonly population: string;
  readonly kind: string;
  readonly projectId: string;
  readonly label: string;
  readonly inclusionProbability: number;
  readonly functionId?: string;
  readonly runId?: string;
  readonly runs: readonly { readonly rationale?: string }[];
}

/** One item of the coding input (what the panel sees). */
export interface CodingItem {
  readonly codingId: string;
  readonly kind: 'violation' | 'judge-unit';
  readonly rule: string;
  readonly rationales: readonly string[];
}

/** One row of the author's key. */
export interface CodingKeyRow {
  readonly codingId: string;
  readonly itemId: string;
  readonly population: 'P3' | 'P4';
  readonly runId: string;
  readonly functionId: string;
  readonly rule: string;
  readonly fpatFamily: string;
  readonly label: string;
  readonly weight: number;
  readonly requestedModelId: string;
  readonly specLevel: string;
  readonly taskId: string;
  readonly runIndex: number;
}

export interface OpenCodingInput {
  readonly version: string;
  readonly seed: number;
  readonly items: readonly CodingItem[];
}

export const OPEN_CODING_KEY_COLUMNS = [
  'coding_id', 'item_id', 'population', 'run_id', 'function_id', 'rule', 'fpat_family', 'label', 'weight',
  'requested_model_id', 'spec_level', 'task_id', 'run_index',
] as const;

const isLabelView = (v: unknown): v is CodingLabelView => {
  const o = v as Partial<CodingLabelView> | null;
  return typeof o === 'object' && o !== null && typeof o.itemId === 'string' && typeof o.population === 'string'
    && typeof o.label === 'string' && typeof o.projectId === 'string' && typeof o.inclusionProbability === 'number' && Array.isArray(o.runs);
};

/** True when a parsed labels file is the labeller's `ReconciledLabel[]` with its runs. */
export function isCodingLabels(v: unknown): v is CodingLabelView[] {
  return Array.isArray(v) && v.every(isLabelView);
}

/** The label of an item that enters the coding (a violation is present). */
export function isCodedLabel(population: string, label: string): boolean {
  return (population === 'P3' && (label === 'TP' || label === 'unseeded-TP')) || (population === 'P4' && label === 'fail');
}

/** Replaces each non-empty term (longest first) by `[redacted]`, case-sensitive and literal. */
export function redact(text: string, terms: readonly string[]): string {
  let out = text;
  for (const t of [...new Set(terms.filter((x) => x !== ''))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))) out = out.split(t).join(REDACTED);
  return out;
}

/** The condition terms of the E1 cells (model ids, task ids, spec levels other than `none`), sorted and unique. */
export function conditionTerms(cells: readonly GenerationCell[]): string[] {
  const t = cells.flatMap((c) => [c.requestedModelId, c.resolvedModelId ?? '', c.taskId, c.specLevel === 'none' ? '' : c.specLevel]);
  return [...new Set(t.filter((x) => x !== ''))].sort();
}

/**
 * The coding input and the author's key. `records` and `reports` are the E1 run directory; a coded item must name an
 * E1 record (its `runId`, or the one accepted E1 record of its project) or the input is refused.
 */
export function openCodingInput(
  labels: readonly CodingLabelView[], records: readonly RunRecord[], reports: ReadonlyMap<string, EvaluationReport>, so5: So5Codes,
  seed: number = OPEN_CODING_SEED,
): { ok: true; input: OpenCodingInput; key: CodingKeyRow[] } | { ok: false; detail: string } {
  const e1 = records.filter((r) => r.cell !== undefined);
  const byRun = new Map(e1.map((r) => [r.runId, r]));
  const condition = conditionTerms(e1.flatMap((r) => (r.cell === undefined ? [] : [r.cell])));
  const drafts: { item: Omit<CodingItem, 'codingId'>; key: Omit<CodingKeyRow, 'codingId'> }[] = [];
  for (const l of [...labels].sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0))) {
    if (l.population !== 'P3' && l.population !== 'P4') continue;
    let record = l.runId === undefined ? undefined : byRun.get(l.runId);
    if (l.runId === undefined) {
      const matches = e1.filter((r) => r.projectId === l.projectId && r.status === 'accepted');
      if (matches.length === 1) record = matches[0];
    }
    // A P4 fixture unit, or any item of another plan, is not an E1 item: left out.
    if (record === undefined) {
      if (l.population === 'P3' && isCodedLabel(l.population, l.label)) {
        return { ok: false, detail: `${OPEN_CODING_INPUT_INVALID}: P3 item ${l.itemId} names no E1 record of --runs` };
      }
      continue;
    }
    if (!isCodedLabel(l.population, l.label)) continue;
    const cell = record.cell;
    if (cell === undefined) continue;
    if (l.functionId === undefined) return { ok: false, detail: `${OPEN_CODING_INPUT_INVALID}: item ${l.itemId} has no function id` };
    if (!(l.inclusionProbability > 0 && l.inclusionProbability <= 1)) {
      return { ok: false, detail: `${OPEN_CODING_INPUT_INVALID}: item ${l.itemId} has inclusion probability ${String(l.inclusionProbability)}` };
    }
    const report = reports.get(record.runId);
    const rule = report?.functionResults.find((f) => String(f.functionId) === l.functionId)?.name ?? l.functionId;
    const dimension = report?.neuralResults?.find((n) => String(n.functionId) === l.functionId)?.dimension;
    const family = l.population === 'P4' ? (dimension === undefined ? undefined : familyOf(so5, dimension)) : familyOf(so5, rule);
    const terms = [...condition, record.runId, record.projectId];
    const rationales = l.runs.map((r) => (typeof r.rationale === 'string' ? redact(r.rationale.trim(), terms) : '')).filter((r) => r !== '');
    drafts.push({
      item: { kind: l.population === 'P3' ? 'violation' : 'judge-unit', rule, rationales },
      key: {
        itemId: l.itemId, population: l.population, runId: record.runId, functionId: l.functionId, rule, fpatFamily: family ?? '', label: l.label,
        weight: 1 / l.inclusionProbability, requestedModelId: cell.requestedModelId, specLevel: cell.specLevel, taskId: cell.taskId, runIndex: cell.runIndex,
      },
    });
  }
  const ordered = shuffle(drafts, createRng(seed));
  const id = (i: number): string => `OC-${String(i + 1).padStart(4, '0')}`;
  return {
    ok: true,
    input: { version: OPEN_CODING_VERSION, seed, items: ordered.map((d, i) => ({ codingId: id(i), ...d.item })) },
    key: ordered.map((d, i) => ({ codingId: id(i), ...d.key })),
  };
}

/** `open-coding-key.csv` rows in `OPEN_CODING_KEY_COLUMNS` order (the weight with six decimals). */
export function keyRows(key: readonly CodingKeyRow[]): string[][] {
  return key.map((k) => [
    k.codingId, k.itemId, k.population, k.runId, k.functionId, k.rule, k.fpatFamily, k.label, k.weight.toFixed(6),
    k.requestedModelId, k.specLevel, k.taskId, String(k.runIndex),
  ]);
}
