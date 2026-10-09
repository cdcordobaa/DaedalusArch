/**
 * Judge verdicts of the P4 units, derived from stored runs (ADR-020 item 7, B3; BR-U5b-33, 43; FR-27).
 *
 * The judge-vs-panel rows of `agreement.csv` are split by source (`e1` headline, `fixture`) and by E1 generator model.
 * Both strata are facts of the run, not of the verdict, so they are derived here from the `RunRecord` and its stored
 * report, never typed by hand (`Docs/analysis-plan.md` §4):
 *
 * - a run counts only when `status = 'accepted'` and it has a stored report;
 * - an E1 run (`cell` present) counts only when it is run index 0 of a generation with `generationStatus = 'ok'`
 *   (P4 takes the judge units of run index 0 of every valid cell); `source = 'e1'`, `generatorModel` = the cell's
 *   `requestedModelId`;
 * - a run of the `fixtures` plan (no cell, no seed) is `source = 'fixture'`, without a generator model;
 * - any other run (seeded SO4 pairs, corpus, sensitivity) is not a P4 source and yields nothing;
 * - per `neuralResults[]` row, every unit with `status = 'valid'` and verdict `pass` / `fail` yields one verdict, the
 *   judge model being the report's `judge.model`. Invalid units (`warning`) are never compared.
 *
 * `missingSource` names the verdicts of a hand-supplied file that lack `source`: without it the E1 headline row cannot
 * be formed and the B3 row would silently fall back to the pooled set, so the agreement CLI refuses such a file.
 */
import type { RunRecord } from './report-io.js';

/** A stored judge verdict for a P4 unit (read only at comparison time, never into a context). */
export interface JudgeUnitVerdict {
  readonly projectId: string;
  readonly functionId: string;
  readonly unitId: string;
  readonly verdict: 'pass' | 'fail';
  readonly judgeModel: string;
  /** Where the unit comes from (ADR-020 item 7): an E1 cell or one of the five dev fixtures; absent = unknown. */
  readonly source?: 'e1' | 'fixture';
  /** The model that generated the E1 project of the unit (self-preference strata). */
  readonly generatorModel?: string;
}

/** The plan whose runs are the fixture P4 source (`experiments/fixtures/plan.json` `id`). */
export const FIXTURES_PLAN_ID = 'fixtures';

/** The report fields read here: the judge model and, per neural row, the unit ids, statuses and verdicts. */
interface ReportVerdictView {
  readonly judge?: { readonly model?: unknown };
  readonly neuralResults?: readonly {
    readonly functionId?: unknown;
    readonly unitResults?: readonly { readonly unitId?: unknown; readonly status?: unknown; readonly verdict?: unknown }[];
  }[];
}

type VerdictSource = Pick<JudgeUnitVerdict, 'source' | 'generatorModel'>;

/** The P4 source of a run, or `null` when the run is not a P4 source. */
export function p4SourceOf(record: RunRecord): VerdictSource | null {
  if (record.status !== 'accepted') return null;
  if (record.cell !== undefined) {
    if (record.cell.runIndex !== 0 || record.cell.generationStatus !== 'ok') return null;
    return { source: 'e1', generatorModel: record.cell.requestedModelId };
  }
  if (record.seed === undefined && record.planId === FIXTURES_PLAN_ID) return { source: 'fixture' };
  return null;
}

/**
 * The judge verdicts of every P4 unit in the given runs, sorted by (projectId, functionId, unitId, judgeModel).
 * `reports` maps `runId` to the stored report (as `loadRunDir` returns it).
 */
export function judgeVerdictsFromRuns(records: readonly RunRecord[], reports: ReadonlyMap<string, unknown>): JudgeUnitVerdict[] {
  const out: JudgeUnitVerdict[] = [];
  for (const record of records) {
    const src = p4SourceOf(record);
    const report = reports.get(record.runId) as ReportVerdictView | undefined;
    if (src === null || report === undefined) continue;
    const judgeModel = typeof report.judge?.model === 'string' ? report.judge.model : '';
    for (const row of report.neuralResults ?? []) {
      if (typeof row.functionId !== 'string') continue;
      for (const u of row.unitResults ?? []) {
        if (typeof u.unitId !== 'string' || u.status !== 'valid' || (u.verdict !== 'pass' && u.verdict !== 'fail')) continue;
        out.push({ projectId: record.projectId, functionId: row.functionId, unitId: u.unitId, verdict: u.verdict, judgeModel, ...src });
      }
    }
  }
  const key = (v: JudgeUnitVerdict): string => JSON.stringify([v.projectId, v.functionId, v.unitId, v.judgeModel]);
  return out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** Indices of verdicts without a `source` (a hand-supplied file is refused when any exist). */
export function missingSource(verdicts: readonly JudgeUnitVerdict[]): number[] {
  return verdicts.flatMap((v, i) => (v.source === 'e1' || v.source === 'fixture' ? [] : [i]));
}
