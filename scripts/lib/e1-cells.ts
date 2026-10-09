/**
 * E1 grid cells, one per coordinate (ADR-021 SO5-05; BR-U5b-54, 64; `Docs/analysis-plan.md` §8 "nothing is dropped").
 *
 * - `e1Coordinates(grid)`: every (model, spec level, task, run) of an `e1` block, in the expansion order of
 *   `run-experiment.ts` (models × levels × tasks × runs).
 * - `e1ProjectId(c)` = `<modelId>/<taskId>/<specLevel>/run-<i>` (the plan entry `projectId`).
 * - `missingE1Cell(c, style, outcomePath)`: the cell of a coordinate without `generation.json`: `generationStatus`
 *   `missing`, zero counts, U5a's adapter id and template id. Its GEN code is `GEN-MISSING` (`cellGenCode`).
 * - `completeE1Cells(records, grid, style)`: for the SO5 outputs (`so5_grid.csv`, `so5_patterns.csv` and the
 *   valid-generation-yield denominator): one cell per coordinate, in coordinate order, taken from the record that
 *   carries it, or synthesised as `missing` when no record does (a run that stopped before the entry, or an older
 *   record without a `cell`). `synthesised` counts those; `extra` lists record cells that match no coordinate.
 *   `aggregate.ts` `so5Records` calls it for a plan with an `e1` block (SO5-05 follow-up).
 */
import { join } from 'node:path';
import { cellOutputDir } from './generators/schedule.js';
import type { GenerationCell } from './report-io.js';

/** The `e1` block fields the enumeration needs. */
export interface E1GridBlock {
  readonly outcomesRoot: string;
  readonly style: string;
  readonly models: readonly string[];
  readonly specLevels: readonly GenerationCell['specLevel'][];
  readonly tasks: readonly { readonly taskId: string; readonly specPath: string }[];
  readonly runs: number;
}

export interface E1Coordinate {
  readonly modelId: string;
  readonly specLevel: GenerationCell['specLevel'];
  readonly taskId: string;
  readonly specPath: string;
  readonly runIndex: number;
  /** `<outcomesRoot>/<modelId>/<taskId>/<specLevel>/run-<i>` (as given: relative or absolute). */
  readonly outcomeDir: string;
}

export const GENERATION_JSON = 'generation.json';
/** U5a's only adapter id (`scripts/lib/generators/types.ts` `CLAUDE_CODE_ADAPTER_ID`). */
export const E1_ADAPTER_ID = 'claude-code-cli';

export function e1Coordinates(grid: E1GridBlock): readonly E1Coordinate[] {
  const out: E1Coordinate[] = [];
  for (const modelId of grid.models) {
    for (const specLevel of grid.specLevels) {
      for (const task of grid.tasks) {
        for (let runIndex = 0; runIndex < grid.runs; runIndex++) {
          out.push({
            modelId, specLevel, taskId: task.taskId, specPath: task.specPath, runIndex,
            outcomeDir: cellOutputDir(grid.outcomesRoot, { modelId, taskId: task.taskId as never, specLevel, runIndex }),
          });
        }
      }
    }
  }
  return out;
}

export function e1ProjectId(c: Pick<E1Coordinate, 'modelId' | 'taskId' | 'specLevel' | 'runIndex'>): string {
  return `${c.modelId}/${c.taskId}/${c.specLevel}/run-${String(c.runIndex)}`;
}

function asRunIndex(i: number): GenerationCell['runIndex'] {
  if (i !== 0 && i !== 1 && i !== 2) throw new Error(`E1 runIndex ${String(i)} is outside 0..2`);
  return i;
}

export function missingE1Cell(c: E1Coordinate, style: string, outcomePath: string = join(c.outcomeDir, GENERATION_JSON)): GenerationCell {
  return {
    requestedModelId: c.modelId, adapterId: E1_ADAPTER_ID, promptTemplateId: `${c.specLevel}/${c.taskId}`, style,
    specLevel: c.specLevel, taskId: c.taskId, runIndex: asRunIndex(c.runIndex), generationOutcomePath: outcomePath,
    generationStatus: 'missing', fileCount: 0, fileCountInRange: false, permissionDenials: 0,
  };
}

function keyOf(modelId: string, taskId: string, specLevel: string, runIndex: number): string {
  return `${modelId}\u0000${taskId}\u0000${specLevel}\u0000${String(runIndex)}`;
}

export interface CompleteE1Cells {
  readonly cells: readonly GenerationCell[];
  readonly synthesised: number;
  readonly extra: readonly GenerationCell[];
}

export function completeE1Cells(records: readonly { readonly cell?: GenerationCell }[], grid: E1GridBlock): CompleteE1Cells {
  const byKey = new Map<string, GenerationCell>();
  const extra: GenerationCell[] = [];
  const coords = e1Coordinates(grid);
  const wanted = new Set(coords.map((c) => keyOf(c.modelId, c.taskId, c.specLevel, c.runIndex)));
  for (const r of records) {
    const cell = r.cell;
    if (cell === undefined) continue;
    const k = keyOf(cell.requestedModelId, cell.taskId, cell.specLevel, cell.runIndex);
    if (!wanted.has(k) || byKey.has(k)) extra.push(cell);
    else byKey.set(k, cell);
  }
  let synthesised = 0;
  const cells = coords.map((c) => {
    const found = byKey.get(keyOf(c.modelId, c.taskId, c.specLevel, c.runIndex));
    if (found !== undefined) return found;
    synthesised++;
    return missingE1Cell(c, grid.style);
  });
  return { cells, synthesised, extra };
}
