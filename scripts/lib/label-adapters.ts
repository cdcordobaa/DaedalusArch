/**
 * Label-shape adapters (ADR-021 SO4-01, SO5-01, SO4-02; FR-27; BR-U5b-10, 38, 64).
 *
 * `llm-label` writes one shape, `ReconciledLabel[]`. Its consumers used to read other shapes and silently got
 * nothing: `score-golden --labels` read an itemId → label map (so FP-labelled came out equal to FP-strict), and
 * `aggregate --labels` read `{runId, functionId, label}` rows (so every symbolic FPAT count came out 0). These
 * adapters convert the labeller's output for each consumer and refuse what cannot be converted, instead of
 * producing zeros. They also give `instances.csv` its FN cause columns.
 *
 * Pure functions only.
 */

export const LABELS_SHAPE_INVALID = 'LABELS_SHAPE_INVALID';

/** The reconciled-label fields the adapters read (`ReconciledLabel` of `scripts/llm-label.ts`). */
export interface LabelView {
  readonly itemId: string;
  readonly population: string;
  readonly kind: string;
  readonly projectId: string;
  readonly label: string;
  readonly inclusionProbability: number;
  readonly functionId?: string;
  readonly stratum?: string;
  /** P3 items: the E1 run whose report holds the violation (set by `build-label-plan`). */
  readonly runId?: string;
  /** Missed-seed items: the seed. */
  readonly seedId?: string;
  readonly rootCause?: string;
}

export type P1Label = 'TP' | 'FP' | 'unseeded-TP' | 'uncertain';
const P1_LABELS: readonly string[] = ['TP', 'FP', 'unseeded-TP', 'uncertain'];

function isLabelView(v: unknown): v is LabelView {
  const o = v as Partial<LabelView> | null;
  return typeof o === 'object' && o !== null && typeof o.itemId === 'string' && typeof o.population === 'string'
    && typeof o.label === 'string' && typeof o.projectId === 'string';
}

/** True when a parsed labels file is the labeller's `ReconciledLabel[]`. */
export function isReconciledLabels(v: unknown): v is LabelView[] {
  return Array.isArray(v) && v.every(isLabelView);
}

/**
 * `score-golden --labels`: the P1 labels by item id. Accepts the labeller's `ReconciledLabel[]` (P1 items only are
 * read) and, for older inputs, an itemId → label object. Anything else is refused.
 */
export function p1LabelsOf(v: unknown): { ok: true; labels: Map<string, P1Label> } | { ok: false; detail: string } {
  if (Array.isArray(v)) {
    if (!isReconciledLabels(v)) return { ok: false, detail: `${LABELS_SHAPE_INVALID}: the labels array is not a ReconciledLabel[] (llm-label output)` };
    const out = new Map<string, P1Label>();
    for (const l of v) {
      if (l.population !== 'P1') continue;
      if (!P1_LABELS.includes(l.label)) return { ok: false, detail: `${LABELS_SHAPE_INVALID}: P1 item ${l.itemId} has label ${l.label}` };
      out.set(l.itemId, l.label as P1Label);
    }
    return { ok: true, labels: out };
  }
  if (typeof v === 'object' && v !== null) {
    const entries = Object.entries(v as Record<string, unknown>);
    const bad = entries.find(([, x]) => typeof x !== 'string' || !P1_LABELS.includes(x));
    if (bad !== undefined) return { ok: false, detail: `${LABELS_SHAPE_INVALID}: label map entry ${bad[0]} is not one of ${P1_LABELS.join(', ')}` };
    return { ok: true, labels: new Map(entries as [string, P1Label][]) };
  }
  return { ok: false, detail: `${LABELS_SHAPE_INVALID}: labels must be a ReconciledLabel[] or an itemId → label object` };
}

/** P1 item ids of the score that have no label (the score is refused when any exist). */
export function unlabelledItems(itemIds: readonly string[], labels: ReadonlyMap<string, P1Label>): string[] {
  return [...new Set(itemIds.filter((id) => !labels.has(id)))].sort();
}

/** `aggregate` FPAT input row (structurally `LabelledViolation` of `scripts/aggregate.ts`). */
export interface FpatLabel {
  readonly runId: string;
  readonly functionId: string;
  readonly label: 'TP' | 'unseeded-TP' | 'FP' | 'uncertain';
  readonly inclusionProbability: number;
}

/** The record fields the run-id mapping reads. */
export interface RecordView {
  readonly runId: string;
  readonly projectId: string;
  readonly status: string;
  readonly cell?: unknown;
}

/**
 * `aggregate --labels`: the P3 labels as FPAT rows. A label's run is its `runId` when set, else the one accepted E1
 * record (`cell` present) of its project id. Refused: a P3 label without a function id, whose run id names no E1
 * record, or whose project id names no accepted E1 record or more than one.
 */
export function fpatLabelsOf(labels: readonly LabelView[], records: readonly RecordView[]): { ok: true; labels: FpatLabel[] } | { ok: false; detail: string } {
  const e1 = records.filter((r) => r.cell !== undefined);
  const byRun = new Set(e1.map((r) => r.runId));
  const out: FpatLabel[] = [];
  for (const l of labels) {
    if (l.population !== 'P3') continue;
    const functionId = l.functionId ?? stratumFunction(l.stratum);
    if (functionId === undefined) return { ok: false, detail: `${LABELS_SHAPE_INVALID}: P3 item ${l.itemId} has no function id` };
    if (l.label !== 'TP' && l.label !== 'unseeded-TP' && l.label !== 'FP' && l.label !== 'uncertain') {
      return { ok: false, detail: `${LABELS_SHAPE_INVALID}: P3 item ${l.itemId} has label ${l.label}` };
    }
    let runId = l.runId;
    if (runId !== undefined && !byRun.has(runId)) return { ok: false, detail: `${LABELS_SHAPE_INVALID}: P3 item ${l.itemId} names run ${runId}, which is not an E1 record of --runs` };
    if (runId === undefined) {
      const matches = e1.filter((r) => r.projectId === l.projectId && r.status === 'accepted');
      if (matches.length !== 1) {
        return { ok: false, detail: `${LABELS_SHAPE_INVALID}: P3 item ${l.itemId} (project ${l.projectId}) matches ${String(matches.length)} accepted E1 records; one is required` };
      }
      runId = matches[0]?.runId ?? '';
    }
    out.push({ runId, functionId, label: l.label, inclusionProbability: l.inclusionProbability });
  }
  return { ok: true, labels: out };
}

/** `'<owner>, <functionId>'` → the function id. */
function stratumFunction(stratum: string | undefined): string | undefined {
  if (stratum === undefined) return undefined;
  const i = stratum.lastIndexOf(', ');
  return i < 0 ? undefined : stratum.slice(i + 2);
}

/** A mechanical FN cause as `build-label-plan` writes it (`FnCause` of `label-context.ts`). */
export interface FnCauseView {
  readonly seedId: string;
  readonly rootCause: string;
  readonly source: string;
}

/**
 * `instances.csv` `fn_root_cause`, `fn_cause_source` of a missed seed (Docs/analysis-plan.md §7): the mechanical
 * cause when a rule of matching-rule §7 assigned one, else the reconciled missed-seed label's root cause
 * (`labeller`), else empty (no cause, or an `uncertain` label).
 */
export function fnCauseColumns(seedId: string, causes: readonly FnCauseView[], labels: readonly LabelView[]): [string, string] {
  const m = causes.find((c) => c.seedId === seedId);
  if (m !== undefined) return [m.rootCause, 'mechanical'];
  const l = labels.find((x) => x.population === 'MS' && x.seedId === seedId);
  if (l !== undefined && l.label !== 'uncertain' && l.rootCause !== undefined) return [l.rootCause, 'labeller'];
  return ['', ''];
}
