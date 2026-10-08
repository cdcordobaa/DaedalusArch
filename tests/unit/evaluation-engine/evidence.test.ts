/**
 * Evidence grammar and id merge (FR-12; U3 BR-U3-07; domain-entities.md §1.2; TF-09).
 */
import {
  formatEvidence, parseEvidence, parseEvidenceValue, mergeById,
} from '../../../src/evaluation-engine/evidence.js';
import type { EvidenceValue } from '../../../src/evaluation-engine/evidence.js';
import { computeViolationId } from '../../../src/evaluation-engine/violation-id.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

class FakeInteger {
  constructor(private readonly low: number) {}
  toNumber(): number { return this.low; }
}

function normalise(value: unknown): EvidenceValue {
  if (value === null || value === undefined) return null;
  if (value instanceof FakeInteger) return value.toNumber();
  if (typeof value === 'number') return value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function only<T>(xs: readonly T[], index = 0): T {
  const x = xs[index];
  if (x === undefined) throw new Error(`no element ${String(index)}`);
  return x;
}

describe('formatEvidence / parseEvidence (domain-entities.md §1.2)', () => {
  it('writes one entry per column in declaration order, numbers in shortest round-trip form', () => {
    const row = { instability: 0.6666666666666666, fanIn: new FakeInteger(7), name: 'Order', extra: 1 };
    expect(formatEvidence(row, ['fanIn', 'instability', 'missing', 'name'])).toEqual([
      'fanIn=7', 'instability=0.6666666666666666', 'missing=null', 'name=Order',
    ]);
  });

  it('TF-09 round-trip law over ints, 0.6666666666666666, null and strings', () => {
    const rows: Record<string, unknown>[] = [
      { a: 0, b: 7, c: -3, d: 1e21 },
      { a: 0.6666666666666666, b: 0.2, c: 0.1 + 0.2, d: 2.5e-7 },
      { a: null, b: undefined, c: 'null-ish', d: 'x=y=z' },
      { a: 'Order', b: '["a.ts","b.ts"]', c: new FakeInteger(42), d: 'src/domain/Order.ts' },
    ];
    const cols = ['a', 'b', 'c', 'd'];
    for (const row of rows) {
      const expected: Record<string, EvidenceValue> = {};
      for (const c of cols) expected[c] = normalise(row[c]);
      expect(parseEvidence(formatEvidence(row, cols))).toEqual(expected);
    }
  });

  it('splits at the first "=" only', () => {
    expect(parseEvidence(['cycle=["a=1.ts","b.ts"]'])).toEqual({ cycle: '["a=1.ts","b.ts"]' });
  });

  it('a numeric-looking text that does not round-trip stays a string', () => {
    expect(parseEvidenceValue('007')).toBe('007');
    expect(parseEvidenceValue('1.50')).toBe('1.50');
    expect(parseEvidenceValue('1.5')).toBe(1.5);
    expect(parseEvidenceValue('-2')).toBe(-2);
    expect(parseEvidenceValue('null')).toBeNull();
  });
});

describe('mergeById (BR-U3-07, BR-U3-70 item 5)', () => {
  const fid = functionId('FF-SO03');
  function depthViolation(depth: number, message: string): Violation {
    return {
      id: computeViolationId({ functionId: fid, filePath: 'src/domain/C.ts', discriminator: ['C'] }),
      type: 'INHERITANCE_DEPTH_EXCEEDED',
      dimension: 'solid',
      severity: 'minor',
      functionId: fid,
      route: 'symbolic',
      filePath: 'src/domain/C.ts',
      message,
      evidence: formatEvidence({ depth }, ['depth']),
      deterministic: true,
      discriminator: ['C'],
    };
  }

  it('three inheritance-depth rows for class C (depths 4, 5, 6) give one violation, depth=6, first row identity', () => {
    const merged = mergeById([
      depthViolation(4, 'C depth 4 > 3'),
      depthViolation(5, 'C depth 5 > 3'),
      depthViolation(6, 'C depth 6 > 3'),
    ]);
    expect(merged).toHaveLength(1);
    expect(only(merged).evidence).toEqual(['depth=6']);
    expect(only(merged).message).toBe('C depth 4 > 3');
  });

  it('keeps distinct ids in first-occurrence order and leaves them untouched', () => {
    const a = depthViolation(4, 'a');
    const other: Violation = { ...depthViolation(9, 'b'), id: 'v-0000000000000001' };
    const merged = mergeById([a, other, depthViolation(2, 'c')]);
    expect(merged.map((v) => v.id)).toEqual([a.id, other.id]);
    expect(only(merged).evidence).toEqual(['depth=4']);
    expect(only(merged, 1)).toBe(other);
  });

  it('non-numeric evidence keeps the first row value', () => {
    const v1: Violation = { ...depthViolation(1, 'm'), evidence: ['depth=null', 'name=A'] };
    const v2: Violation = { ...depthViolation(1, 'm'), evidence: ['depth=3', 'name=B'] };
    expect(only(mergeById([v1, v2])).evidence).toEqual(['depth=null', 'name=A']);
  });
});
