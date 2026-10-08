/**
 * Violation id hasher (FR-12; U3 BR-U3-05, BR-U3-06, BR-U3-13; domain-entities.md §1.1; TF-14).
 */
import {
  computeViolationId, discriminatorValue, discriminatorValues, toFiniteNumber,
} from '../../../src/evaluation-engine/violation-id.js';
import type { ViolationIdInput } from '../../../src/evaluation-engine/violation-id.js';
import { formatEvidence } from '../../../src/evaluation-engine/evidence.js';
import * as evaluationEngine from '../../../src/evaluation-engine/index.js';

/** Minimal stand-in for a Neo4j driver `Integer`. */
class FakeInteger {
  constructor(private readonly low: number) {}
  toNumber(): number { return this.low; }
}

interface DepRow extends Record<string, unknown> {
  readonly source: string;
  readonly target?: string;
  readonly line?: unknown;
  readonly relType: string;
}

function idOfRow(functionId: string, row: DepRow, disc: readonly string[]): string {
  const line = toFiniteNumber(row.line);
  const target = row.target;
  const input: ViolationIdInput = {
    functionId,
    filePath: row.source,
    discriminator: discriminatorValues(row, disc),
    ...(typeof target === 'string' ? { target } : {}),
    ...(line !== undefined ? { line } : {}),
  };
  return computeViolationId(input);
}

describe('computeViolationId (BR-U3-05, frozen encoding)', () => {
  it('(c) pinned vector: FF-S01 a.ts -> b.ts line 2 IMPORTS', () => {
    // Recorded at Code Generation (U3 Step 8); the encoding is frozen (BR-U3-70 item 6).
    expect(computeViolationId({
      functionId: 'FF-S01', filePath: 'src/domain/a.ts', target: 'src/infra/b.ts', line: 2, discriminator: ['IMPORTS'],
    })).toBe('v-35e9098753c1674b');
  });

  it('has the shape v- plus 16 lowercase hex characters', () => {
    expect(computeViolationId({ functionId: 'FF-C01', filePath: 'x.ts', discriminator: [] })).toMatch(/^v-[0-9a-f]{16}$/);
  });

  it('(a) the same rows give the same ids in two calls', () => {
    const input = { functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', line: 3, discriminator: ['IMPORTS'] };
    expect(computeViolationId(input)).toBe(computeViolationId({ ...input }));
  });

  it('(b) TF-14: shuffling the rows of a result leaves the multiset of ids unchanged', () => {
    const rows: DepRow[] = [
      { source: 'src/domain/a.ts', target: 'src/infra/b.ts', line: 2, relType: 'IMPORTS' },
      { source: 'src/domain/a.ts', target: 'src/infra/b.ts', line: 2, relType: 'RE_EXPORTS' },
      { source: 'src/domain/a.ts', target: 'src/infra/c.ts', line: 5, relType: 'IMPORTS' },
      { source: 'src/domain/d.ts', target: 'src/infra/b.ts', line: null, relType: 'IMPORTS' },
    ];
    const ids = rows.map((r) => idOfRow('FF-S01', r, ['relType'])).sort();
    const shuffled = [2, 0, 3, 1].flatMap((i) => rows.slice(i, i + 1));
    expect(shuffled).toHaveLength(4);
    expect(shuffled.map((r) => idOfRow('FF-S01', r, ['relType'])).sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(4);
  });

  it('(d) line 2 and line undefined give different ids', () => {
    const base = { functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', discriminator: ['IMPORTS'] };
    expect(computeViolationId({ ...base, line: 2 })).not.toBe(computeViolationId(base));
  });

  it('keeps numbers and strings apart (2 is not "2") and treats a non-finite line as absent', () => {
    const base = { functionId: 'FF-S01', filePath: 'a.ts', discriminator: [] };
    expect(computeViolationId({ ...base, line: 2 })).not.toBe(computeViolationId({ ...base, target: '2' }));
    expect(computeViolationId({ ...base, line: Number.NaN })).toBe(computeViolationId(base));
  });

  it('absent target equals the empty-string target (the encoding writes "")', () => {
    const base = { functionId: 'FF-C03', filePath: 'a.ts', discriminator: [] };
    expect(computeViolationId({ ...base, target: '' })).toBe(computeViolationId(base));
  });

  it('a Neo4j Integer line hashes like the plain number', () => {
    const row = { source: 'a.ts', target: 'b.ts', line: new FakeInteger(2), relType: 'IMPORTS' };
    expect(idOfRow('FF-S01', row, ['relType'])).toBe(computeViolationId({
      functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', line: 2, discriminator: ['IMPORTS'],
    }));
  });

  it('BR-U3-06: max-fan-in rows differing only in measured fanIn give the same id and different evidence', () => {
    // B gains an unrelated importer: fanIn 7 -> 8. max-fan-in has no discriminator; fanIn is evidence (T-MAP).
    const before = { filePath: 'src/domain/B.ts', fanIn: 7 };
    const after = { filePath: 'src/domain/B.ts', fanIn: 8 };
    const id = (row: { filePath: string; fanIn: number }): string =>
      computeViolationId({ functionId: 'FF-C04', filePath: row.filePath, discriminator: discriminatorValues(row, []) });
    expect(id(after)).toBe(id(before));
    expect(formatEvidence(after, ['fanIn'])).not.toEqual(formatEvidence(before, ['fanIn']));
  });

  it('BR-U3-13: neural inputs differing only in unitId give different ids', () => {
    const neural = (unitId: string): string =>
      computeViolationId({ functionId: 'FF-N01', filePath: 'src/domain/Order.ts', discriminator: [unitId] });
    expect(neural('src/domain/Order.ts')).not.toBe(neural('Order@src/domain/Order.ts'));
  });

  it('BR-U3-13: computeNeuronalViolationId is not exported', () => {
    expect(Object.keys(evaluationEngine)).not.toContain('computeNeuronalViolationId');
    expect(typeof evaluationEngine.computeViolationId).toBe('function');
  });
});

describe('discriminator values (domain-entities.md §1.1)', () => {
  it('lists are JSON, null and missing are empty, numbers are String(Number(x))', () => {
    expect(discriminatorValue(['a.ts', 'b.ts', 'a.ts'])).toBe('["a.ts","b.ts","a.ts"]');
    expect(discriminatorValue(null)).toBe('');
    expect(discriminatorValue(undefined)).toBe('');
    expect(discriminatorValue(new FakeInteger(4))).toBe('4');
    expect(discriminatorValue('IMPORTS')).toBe('IMPORTS');
    expect(discriminatorValues({ relType: 'IMPORTS', role: null }, ['relType', 'role', 'missing'])).toEqual(['IMPORTS', '', '']);
  });

  it('toFiniteNumber reads numbers, Neo4j Integers and bigints; rejects the rest', () => {
    expect(toFiniteNumber(2)).toBe(2);
    expect(toFiniteNumber(new FakeInteger(9))).toBe(9);
    expect(toFiniteNumber(BigInt(5))).toBe(5);
    expect(toFiniteNumber('2')).toBeUndefined();
    expect(toFiniteNumber(null)).toBeUndefined();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
