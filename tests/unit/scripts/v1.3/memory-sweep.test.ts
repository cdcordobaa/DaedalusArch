/**
 * R17 (Docs/v1.3/post-merge-review-2026-10-16.md): the parity classifier. A row-order difference is `order` (traps T1
 * and T2, Docs/v1.3/cypher-interpreter.md) only when the statement's final RETURN has no ORDER BY, or when the rows
 * that moved are tied on every ORDER BY key; under a final ORDER BY any other reordering is `content`, so the
 * memory-parity gate fails on it.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { QueryResult } from '../../../../src/shared/interfaces/graph-repository.js';
import { classify } from '../../../../scripts/v1.3/lib/memory-sweep.js';

const res = (records: Record<string, unknown>[]): DomainResult<QueryResult> => DomainResult.ok({ records, summary: { counters: {} } });
const paths = (...ps: string[]): DomainResult<QueryResult> => res(ps.map((filePath) => ({ filePath })));

describe('memory-sweep classify (R17)', () => {
  it('R17: a reordering under a final ORDER BY is content', () => {
    const q = 'MATCH (f:File) RETURN f.filePath AS filePath ORDER BY filePath';
    expect(classify(paths('a', 'b', 'c'), paths('b', 'a', 'c'), false, q).klass).toBe('content');
    expect(classify(paths('a', 'b', 'c'), paths('a', 'b', 'c'), false, q).klass).toBe('equal');
    expect(classify(paths('a', 'b'), paths('b', 'a'), false, 'MATCH (f:File)\nRETURN f.filePath AS filePath\norder by filePath DESC LIMIT 10').klass).toBe('content');
  });
  it('R17: a reordering without a final ORDER BY stays order (trap T1)', () => {
    expect(classify(paths('a', 'b'), paths('b', 'a'), false, 'MATCH (f:File) RETURN f.filePath AS filePath').klass).toBe('order');
    const withOnly = 'MATCH (f:File) WITH f ORDER BY f.filePath RETURN f.filePath AS filePath';
    expect(classify(paths('a', 'b'), paths('b', 'a'), false, withOnly).klass).toBe('order');
    expect(classify(paths('a', 'b'), paths('b', 'a'), false).klass).toBe('order');
  });
  it('R17: rows tied on every ORDER BY key may be reordered (order); rows that are not tied may not (content)', () => {
    const q = 'MATCH (f:File) RETURN f.layer AS layer, f.filePath AS filePath ORDER BY layer';
    const ref = res([{ layer: 'd', filePath: 'a' }, { layer: 'd', filePath: 'b' }, { layer: 'i', filePath: 'c' }]);
    const tied = res([{ layer: 'd', filePath: 'b' }, { layer: 'd', filePath: 'a' }, { layer: 'i', filePath: 'c' }]);
    const moved = res([{ layer: 'i', filePath: 'c' }, { layer: 'd', filePath: 'a' }, { layer: 'd', filePath: 'b' }]);
    expect(classify(ref, tied, false, q).klass).toBe('order');
    expect(classify(ref, moved, false, q).klass).toBe('content');
    // An ORDER BY key written as the projected expression maps to its column.
    expect(classify(ref, tied, false, 'MATCH (f:File) RETURN f.layer AS layer, f.filePath AS filePath ORDER BY f.layer').klass).toBe('order');
    // A key that is not a returned column cannot be checked: any reordering is content.
    expect(classify(ref, tied, false, 'MATCH (f:File) RETURN f.layer AS layer, f.filePath AS filePath ORDER BY f.name').klass).toBe('content');
  });
  it('R17: a float accumulation difference stays order (trap T2)', () => {
    const q = 'MATCH (f:File) RETURN f.layer AS layer, avg(f.size) AS s ORDER BY layer';
    const a = res([{ layer: 'd', s: 0.1 + 0.2 }]);
    const b = res([{ layer: 'd', s: 0.3 }]);
    expect(classify(a, b, false, q).klass).toBe('order');
  });
});
