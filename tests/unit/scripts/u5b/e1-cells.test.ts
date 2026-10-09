/**
 * E1 cell enumeration and missing cells (ADR-021 SO5-05): `e1Coordinates`, `missingE1Cell`, `completeE1Cells` (the
 * helper `aggregate.ts` `so5Records` calls) and the join GEN codes (`cellGenCode`). Hand-computed fixtures.
 */
import { completeE1Cells, e1Coordinates, e1ProjectId, missingE1Cell } from '../../../../scripts/lib/e1-cells.js';
import type { E1GridBlock } from '../../../../scripts/lib/e1-cells.js';
import type { GenerationCell } from '../../../../scripts/lib/report-io.js';
import { cellGenCode, JOIN_GEN_CODES, loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import { loadPlan } from '../../../../scripts/run-experiment.js';
import { ROOT } from './score-fixture.js';

const GRID: E1GridBlock = {
  outcomesRoot: 'gen', style: 'clean-architecture', models: ['m1', 'm2'], specLevels: ['none', 'full-aac'],
  tasks: [{ taskId: 'task-management', specPath: 's.yaml' }], runs: 2,
};

const okCell = (modelId: string, specLevel: GenerationCell['specLevel'], runIndex: 0 | 1 | 2, over: Partial<GenerationCell> = {}): GenerationCell => ({
  requestedModelId: modelId, adapterId: 'claude-code-cli', promptTemplateId: `${specLevel}/task-management`, style: 'clean-architecture',
  specLevel, taskId: 'task-management', runIndex, generationOutcomePath: `gen/${modelId}/task-management/${specLevel}/run-${String(runIndex)}/generation.json`,
  generationStatus: 'ok', fileCount: 30, fileCountInRange: true, permissionDenials: 0, ...over,
});

describe('e1Coordinates', () => {
  it('2 models × 2 levels × 1 task × 2 runs = 8, in models × levels × tasks × runs order', () => {
    const c = e1Coordinates(GRID);
    expect(c.map(e1ProjectId)).toEqual([
      'm1/task-management/none/run-0', 'm1/task-management/none/run-1', 'm1/task-management/full-aac/run-0', 'm1/task-management/full-aac/run-1',
      'm2/task-management/none/run-0', 'm2/task-management/none/run-1', 'm2/task-management/full-aac/run-0', 'm2/task-management/full-aac/run-1',
    ]);
    expect(c[3]?.outcomeDir).toBe('gen/m1/task-management/full-aac/run-1');
    expect(c[3]?.specPath).toBe('s.yaml');
  });

  it('the registered E1 plan enumerates 54 coordinates', () => {
    const p = loadPlan(`${ROOT}/experiments/e1-grid/plan.json`, ROOT);
    if (!p.ok || p.plan.e1 === undefined) throw new Error('e1 plan');
    expect(e1Coordinates(p.plan.e1)).toHaveLength(54);
  });
});

describe('missingE1Cell and completeE1Cells (SO5-05)', () => {
  it('a missing cell has status missing, zero counts and the outcome path of its coordinate', () => {
    const c = e1Coordinates(GRID)[1];
    if (c === undefined) throw new Error('coord');
    expect(missingE1Cell(c, 'clean-architecture')).toEqual({
      requestedModelId: 'm1', adapterId: 'claude-code-cli', promptTemplateId: 'none/task-management', style: 'clean-architecture',
      specLevel: 'none', taskId: 'task-management', runIndex: 1, generationOutcomePath: 'gen/m1/task-management/none/run-1/generation.json',
      generationStatus: 'missing', fileCount: 0, fileCountInRange: false, permissionDenials: 0,
    });
  });

  it('3 record cells + 1 record without a cell + 1 off-grid cell over an 8-coordinate grid → 8 cells, 5 synthesised, 1 extra', () => {
    const records = [
      { cell: okCell('m1', 'none', 0) },
      { cell: okCell('m2', 'full-aac', 1, { generationStatus: 'failed-typecheck', failureReason: 'typecheck' }) },
      { cell: okCell('m1', 'full-aac', 0, { generationStatus: 'missing', fileCount: 0, fileCountInRange: false }) },
      {},
      { cell: okCell('m3', 'none', 0) },
    ];
    const r = completeE1Cells(records, GRID);
    expect(r.cells).toHaveLength(8);
    expect(r.synthesised).toBe(5);
    expect(r.extra.map((c) => c.requestedModelId)).toEqual(['m3']);
    expect(r.cells.map((c) => c.generationStatus)).toEqual(['ok', 'missing', 'missing', 'missing', 'missing', 'missing', 'missing', 'failed-typecheck']);
    expect(r.cells[1]?.runIndex).toBe(1);
  });

  it('a duplicate record cell for one coordinate keeps the first and lists the second as extra', () => {
    const r = completeE1Cells([{ cell: okCell('m1', 'none', 0) }, { cell: okCell('m1', 'none', 0, { fileCount: 99 }) }], GRID);
    expect(r.cells[0]?.fileCount).toBe(30);
    expect(r.extra.map((c) => c.fileCount)).toEqual([99]);
  });
});

describe('cellGenCode', () => {
  it('missing → GEN-MISSING, protocol-mismatch → GEN-PROTOCOL-MISMATCH, U5a reasons → the registered table, ok → none', () => {
    const codes = loadSo5Codes(ROOT);
    if (!codes.ok) throw new Error(codes.detail);
    expect(cellGenCode(codes.codes, { generationStatus: 'missing' })).toBe('GEN-MISSING');
    expect(cellGenCode(codes.codes, { generationStatus: 'protocol-mismatch' })).toBe('GEN-PROTOCOL-MISMATCH');
    expect(cellGenCode(codes.codes, { generationStatus: 'failed-agent', failureReason: 'timeout' })).toBe('GEN-TIMEOUT');
    expect(cellGenCode(codes.codes, { generationStatus: 'ok' })).toBeUndefined();
    expect(Object.values(JOIN_GEN_CODES).some((c) => (Object.values(codes.codes.genCodes) as string[]).includes(c))).toBe(false);
  });
});
