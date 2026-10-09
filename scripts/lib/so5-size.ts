/**
 * SO5 size, density and latency columns (ADR-021 SO5-07, X-3; proposal SO5 metrics "violation density per 1K LOC,
 * latency per generated project"; registered as exploratory in `Docs/analysis-plan.md` §3 by P-U6).
 *
 * - LOC of a generated project = the non-blank lines (a line with at least one non-whitespace character) of the
 *   `src/**\/*.ts` files that `fileCount` counts (BR-U5a-48, `sourceFilePaths`). Comments count; blank lines do not.
 *   `run-experiment.ts` `joinOutcome` measures it once, over the tree it evaluates, and stores it in the cell.
 * - Generation effort = `generation.json` `durationMs` (the harness wall time of the cell) and the envelope's
 *   `num_turns` and `total_cost_usd` (BR-U5a-46, tolerant extract).
 * - Density = violations ÷ (LOC ÷ 1000), deterministic violations (`Violation.deterministic`) and all report
 *   violations (deterministic plus judge) separately. Undefined when the cell has no report or LOC is 0 or unknown.
 * - Instrument latency per project = the report's `timings.totalMs` (the sum of the pipeline stage times).
 *
 * Pure functions, except `treeLoc` and `readGenerationEffort`, which read the generated tree.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import { summariseEnvelope } from './generators/envelope.js';
import { sourceFilePaths } from './generators/outcome.js';

/** The `so5_grid.csv` columns this module fills, in order (appended after `gen_code`). */
export const SO5_SIZE_COLUMNS = [
  'loc', 'violations_deterministic', 'violations_total', 'violations_per_kloc', 'violations_total_per_kloc',
  'generation_ms', 'generation_turns', 'generation_cost_usd', 'eval_total_ms',
] as const;

/** Non-blank lines of a source text: lines (split on `\n`, a trailing `\r` ignored) with a non-whitespace character. */
export function nonBlankLines(text: string): number {
  let n = 0;
  for (const line of text.split('\n')) if (/\S/.test(line)) n += 1;
  return n;
}

/** LOC of a generated tree: `nonBlankLines` summed over `sourceFilePaths(dir)` (0 when `src` is absent). */
export function treeLoc(dir: string, read: (file: string) => string = (f) => readFileSync(f, 'utf8')): number {
  let loc = 0;
  for (const rel of sourceFilePaths(dir)) loc += nonBlankLines(read(join(dir, 'src', ...rel.split('/'))));
  return loc;
}

/** Violations per 1000 LOC; `undefined` without a count or with LOC 0 or unknown. */
export function violationsPerKloc(violations: number | undefined, loc: number | undefined): number | undefined {
  if (violations === undefined || loc === undefined || !(loc > 0)) return undefined;
  return (violations * 1000) / loc;
}

/** The generation effort fields a `GenerationCell` carries (all optional; absent when not recorded). */
export interface GenerationEffort {
  readonly generationDurationMs?: number;
  readonly numTurns?: number;
  readonly totalCostUsd?: number;
}

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Effort from a parsed `generation.json` and its parsed envelope (either may be absent or partial). */
export function generationEffortOf(outcome: Readonly<Record<string, unknown>>, envelope: Readonly<Record<string, unknown>> | undefined): GenerationEffort {
  const s = envelope === undefined ? {} : summariseEnvelope(envelope);
  const duration = finite(outcome.durationMs);
  const turns = finite(s.numTurns);
  const cost = finite(s.totalCostUsd);
  return {
    ...(duration !== undefined && { generationDurationMs: duration }),
    ...(turns !== undefined && Number.isInteger(turns) && { numTurns: turns }),
    ...(cost !== undefined && { totalCostUsd: cost }),
  };
}

/** Reads the envelope named by `generation.json` `envelopePath` (default `envelope.json`) beside it; unreadable → none. */
export function readGenerationEffort(outcomeDir: string, outcome: Readonly<Record<string, unknown>>): GenerationEffort {
  const rel = typeof outcome.envelopePath === 'string' && outcome.envelopePath !== '' ? outcome.envelopePath : 'envelope.json';
  let envelope: Record<string, unknown> | undefined;
  try {
    const raw = JSON.parse(readFileSync(join(outcomeDir, rel), 'utf8')) as unknown;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) envelope = raw as Record<string, unknown>;
  } catch {
    envelope = undefined;
  }
  return generationEffortOf(outcome, envelope);
}

/** The size and latency values of one `so5_grid.csv` row (numbers; the caller formats them). */
export interface So5SizeValues {
  readonly loc?: number;
  readonly violationsDeterministic?: number;
  readonly violationsTotal?: number;
  readonly violationsPerKloc?: number;
  readonly violationsTotalPerKloc?: number;
  readonly generationMs?: number;
  readonly generationTurns?: number;
  readonly generationCostUsd?: number;
  readonly evalTotalMs?: number;
}

/** The cell fields `so5SizeValues` reads (`GenerationCell` of `report-io.ts`). */
export interface SizedCell extends GenerationEffort {
  readonly loc?: number;
}

/**
 * The size values of one E1 cell. Violation counts, densities and the instrument latency need a report (a valid
 * cell); LOC and the generation effort are kept for every cell that recorded them.
 */
export function so5SizeValues(cell: SizedCell, report: EvaluationReport | undefined): So5SizeValues {
  // A report without a `violations` array (only hand-built fixtures) gives no counts rather than zero.
  const violations = (report as { readonly violations?: EvaluationReport['violations'] } | undefined)?.violations;
  const det = violations?.filter((v) => v.deterministic).length;
  const total = violations?.length;
  const perKloc = violationsPerKloc(det, cell.loc);
  const totalPerKloc = violationsPerKloc(total, cell.loc);
  const evalMs = finite((report as { timings?: { totalMs?: unknown } } | undefined)?.timings?.totalMs);
  return {
    ...(cell.loc !== undefined && { loc: cell.loc }),
    ...(det !== undefined && { violationsDeterministic: det }),
    ...(total !== undefined && { violationsTotal: total }),
    ...(perKloc !== undefined && { violationsPerKloc: perKloc }),
    ...(totalPerKloc !== undefined && { violationsTotalPerKloc: totalPerKloc }),
    ...(cell.generationDurationMs !== undefined && { generationMs: cell.generationDurationMs }),
    ...(cell.numTurns !== undefined && { generationTurns: cell.numTurns }),
    ...(cell.totalCostUsd !== undefined && { generationCostUsd: cell.totalCostUsd }),
    ...(evalMs !== undefined && { evalTotalMs: evalMs }),
  };
}
