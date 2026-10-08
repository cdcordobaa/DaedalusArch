/**
 * U3-R3 (FR-35): the evaluator drops the cycle sentinel row and marks truncation
 * (U3 business-rules.md BR-U3-08, BR-U3-09; TF-15, TF-26).
 */
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { CYCLE_ROW_CAP, CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { PipelineWarning } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherQuery, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

function stubRepo(records: Record<string, unknown>[]): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records, summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

function query(name: string, id: string): CypherQuery {
  return {
    functionId: functionId(id), name, cypher: CYPHER_TEMPLATES.get(name)?.template ?? 'MATCH (n) RETURN n',
    params: {}, dimension: 'structural', severity: 'critical', route: 'symbolic', source: 'template',
  };
}

/** U1-shaped canonical cycle row i: `[f<i>, g<i>, f<i>]` (f < g). */
function cycleRow(i: number): Record<string, unknown> {
  const a = `src/f${String(i).padStart(3, '0')}.ts`;
  const b = `src/g${String(i).padStart(3, '0')}.ts`;
  return { cycle: [a, b, a], target: b, line: 1 };
}

/** The same cycle as `cycleRow(i)`, rotated to start at the larger member. */
function rotatedRow(i: number): Record<string, unknown> {
  const a = `src/f${String(i).padStart(3, '0')}.ts`;
  const b = `src/g${String(i).padStart(3, '0')}.ts`;
  return { cycle: [b, a, b], target: a, line: 5 };
}

async function evaluate(records: Record<string, unknown>[], name = 'no-cyclic-deps'): Promise<{
  result: SymbolicFunctionResult; warnings: readonly PipelineWarning[];
}> {
  const out = await evaluateSymbolic({ queries: [query(name, 'FF-S02')], graphRepository: stubRepo(records) });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  const result = out.data.results[0];
  if (result === undefined) throw new Error('no result');
  return { result, warnings: out.data.warnings };
}

describe('BR-U3-08 cycle sentinel', () => {
  it('cap is 100 (U1 CYCLE_ROW_CAP)', () => {
    expect(CYCLE_ROW_CAP).toBe(100);
  });

  it('TF-15: 101 raw rows → 100 violations, truncated, one EVAL_003 {functionId, cap: 100}', async () => {
    const rows = Array.from({ length: CYCLE_ROW_CAP + 1 }, (_, i) => cycleRow(i));
    const { result, warnings } = await evaluate(rows);
    expect(result.violations).toHaveLength(100);
    expect(result.truncated).toBe(true);
    expect(result.passed).toBe(false);
    const eval003 = warnings.filter((w) => w.code === 'EVAL_003');
    expect(eval003).toHaveLength(1);
    expect(eval003[0]?.context).toEqual({ functionId: 'FF-S02', cap: 100 });
    expect(eval003[0]?.stage).toBe('evaluation-engine');
    // The sentinel row (row 101) is the one dropped.
    expect(result.violations.map((v) => v.filePath)).not.toContain('src/f100.ts,src/g100.ts,src/f100.ts');
  });

  it('100 raw rows → 100 violations, no truncated key, no warning', async () => {
    const rows = Array.from({ length: CYCLE_ROW_CAP }, (_, i) => cycleRow(i));
    const { result, warnings } = await evaluate(rows);
    expect(result.violations).toHaveLength(100);
    expect(result).not.toHaveProperty('truncated');
    expect(warnings).toEqual([]);
  });

  it('TF-26: 101 raw rows, two of them rotations of one cycle → truncated; de-duplication only after the cap', async () => {
    // Rows 0..98 distinct, row 99 = rotation of row 0, row 100 = rotation of row 1 (the sentinel).
    const rows = [...Array.from({ length: 99 }, (_, i) => cycleRow(i)), rotatedRow(0), rotatedRow(1)];
    expect(rows).toHaveLength(101);
    const { result, warnings } = await evaluate(rows);
    expect(result.truncated).toBe(true);
    expect(warnings.filter((w) => w.code === 'EVAL_003')).toHaveLength(1);
    // Cap keeps rows 0..99; de-dup then drops row 99 (rotation of row 0): 99 violations.
    expect(result.violations).toHaveLength(99);
    expect(new Set(result.violations.map((v) => v.id)).size).toBe(99);
  });

  it('a rotated duplicate below the cap is removed and the kept row stays canonical (BR-U3-09)', async () => {
    const { result, warnings } = await evaluate([cycleRow(0), rotatedRow(0), cycleRow(1)]);
    expect(result).not.toHaveProperty('truncated');
    expect(warnings).toEqual([]);
    expect(result.violations.map((v) => v.filePath)).toEqual([
      'src/f000.ts,src/g000.ts,src/f000.ts', 'src/f001.ts,src/g001.ts,src/f001.ts',
    ]);
    expect(result.violations[0]?.line).toBe(1);
  });

  it('a lone rotated row is canonicalised: filePath and target follow the rotation, line dropped', async () => {
    const { result } = await evaluate([rotatedRow(7)]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.filePath).toBe('src/f007.ts,src/g007.ts,src/f007.ts');
    expect(result.violations[0]?.target).toBe('src/g007.ts');
    expect(result.violations[0]).not.toHaveProperty('line');
  });

  it('U1-shaped canonical rows pass through unchanged (same violations as without the canonicaliser)', async () => {
    const rows = [cycleRow(0), cycleRow(1), cycleRow(2)];
    const { result } = await evaluate(rows);
    expect(result.violations.map((v) => [v.filePath, v.target, v.line])).toEqual(
      rows.map((r) => [(r.cycle as string[]).join(','), r.target, r.line]),
    );
  });

  it('templates without a cycle column are never capped', async () => {
    const rows = Array.from({ length: CYCLE_ROW_CAP + 5 }, (_, i) => ({ filePath: `src/o${String(i)}.ts`, name: 'o', layer: 'domain' }));
    const { result, warnings } = await evaluate(rows, 'no-orphan-files');
    expect(result.violations).toHaveLength(105);
    expect(result).not.toHaveProperty('truncated');
    expect(warnings).toEqual([]);
  });
});
