/**
 * Parity classes of the cypher-interp differential harness (scripts/v1.3/lib/memory-sweep.ts;
 * Docs/v1.3/cypher-interpreter.md §4): `order` is a pure row-order difference; `float-drift` is a last-bits FLOAT
 * difference within the ULP bound, allowed ONLY for the named metric texts and recorded with both values.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../../../src/scoring-engine/universal-metrics.js';
import { FLOAT_DRIFT_MAX_ULPS, FLOAT_DRIFT_TEMPLATES, classify, ulpDistance } from '../../../scripts/v1.3/lib/memory-sweep.js';

const result = (records: Record<string, unknown>[]): DomainResult<QueryResult> => DomainResult.ok({ records, summary: { counters: {} } });

/** The double `ulps` units in the last place above `x` (x > 0). */
function nextUp(x: number, ulps: number): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  v.setBigInt64(0, v.getBigInt64(0) + BigInt(ulps));
  return v.getFloat64(0);
}

const AVG = UNIVERSAL_METRIC_QUERIES.averageInstability;
const X = 0.4556650246305418;

describe('memory-sweep: parity classes', () => {
  it('names exactly the two averageInstability texts as the float-drift templates', () => {
    expect([...FLOAT_DRIFT_TEMPLATES.keys()].sort()).toEqual([UNIVERSAL_METRIC_QUERIES.averageInstability, UNIVERSAL_METRIC_QUERIES_LITERAL.averageInstability].sort());
    expect(FLOAT_DRIFT_MAX_ULPS).toBe(16);
  });

  it('measures ULP distance', () => {
    expect(ulpDistance(X, X)).toBe(0);
    expect(ulpDistance(X, nextUp(X, 1))).toBe(1);
    expect(ulpDistance(nextUp(X, 3), X)).toBe(3);
    expect(ulpDistance(1, -1)).toBe(Infinity);
    expect(ulpDistance(Number.NaN, 1)).toBe(Infinity);
  });

  it('classes a pure row-order difference as order, never float-drift', () => {
    const c = classify(result([{ a: 1.5 }, { a: 2.5 }]), result([{ a: 2.5 }, { a: 1.5 }]), false, 'MATCH (n) RETURN n.a AS a');
    expect(c.klass).toBe('order');
    expect(c.floatDrift).toBeUndefined();
  });

  it('classes a reordering under an ORDER BY as content, not order (post-merge review R17)', () => {
    const c = classify(result([{ a: 1.5 }, { a: 2.5 }]), result([{ a: 2.5 }, { a: 1.5 }]), false, 'MATCH (n) RETURN n.a AS a ORDER BY a');
    expect(c.klass).toBe('content');
    expect(classify(result([{ a: 1.5 }, { a: 2.5 }]), result([{ a: 2.5 }, { a: 1.5 }]), false, 'MATCH (n) WITH n ORDER BY n.a RETURN n.a AS a').klass).toBe('order');
  });

  it('classes a last-bit difference on a named metric text as float-drift and records both values', () => {
    const y = nextUp(X, 1);
    const c = classify(result([{ val: X }]), result([{ val: y }]), false, AVG);
    expect(c.klass).toBe('float-drift');
    expect(c.floatDrift).toEqual([{ row: 0, column: 'val', neo4j: String(X), interp: String(y), ulps: 1 }]);
  });

  it('accepts drift up to the bound and not beyond it', () => {
    expect(classify(result([{ val: X }]), result([{ val: nextUp(X, FLOAT_DRIFT_MAX_ULPS) }]), false, AVG).klass).toBe('float-drift');
    expect(classify(result([{ val: X }]), result([{ val: nextUp(X, FLOAT_DRIFT_MAX_ULPS + 1) }]), false, AVG).klass).toBe('content');
  });

  it('never applies the tolerance to any other avg / sum text, a future template included', () => {
    const y = nextUp(X, 1);
    for (const text of [
      'MATCH (f:File) RETURN avg(f.x) AS val',
      'MATCH (f:File) RETURN sum(f.x) AS val',
      `${AVG} `, // not the named text: compared bit for bit
      UNIVERSAL_METRIC_QUERIES.abstractionRatio,
    ]) {
      expect(classify(result([{ val: X }]), result([{ val: y }]), false, text).klass).toBe('content');
    }
  });

  it('does not let float-drift hide a difference in any other column or row', () => {
    const y = nextUp(X, 1);
    expect(classify(result([{ val: X, n: 'a' }]), result([{ val: y, n: 'b' }]), false, AVG).klass).toBe('content');
    expect(classify(result([{ val: X }]), result([{ val: y }, { val: y }]), false, AVG).klass).toBe('content');
  });
});
