/**
 * R16 (Docs/v1.3/post-merge-review-2026-10-16.md): `sign()` and float-to-integer conversion follow Neo4j's Java casts.
 * Neo4j casts `Math.signum` to long (NaN gives 0) and `toInteger` of a FLOAT is a Java `(long)` cast: NaN gives 0,
 * values outside the int64 range (and the infinities) saturate at Long.MIN_VALUE / Long.MAX_VALUE.
 */
import neo4j from 'neo4j-driver';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';

const repo = new MemoryGraphRepository();

/** The single column of the single row, INTEGERs as `{int: '<decimal>'}` so INTEGER vs FLOAT stays visible. */
async function value(cypher: string): Promise<unknown> {
  const r = await repo.executeQuery(cypher, {});
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  const v = Object.values(r.data.records[0] ?? {})[0];
  return neo4j.isInt(v) ? { int: (v as { toString(): string }).toString() } : v;
}

const INT64_MAX = '9223372036854775807';
const INT64_MIN = '-9223372036854775808';

describe('cypher-interp: Java numeric casts (R16)', () => {
  it('R16: sign(NaN) is 0 (Neo4j casts Math.signum to long)', async () => {
    expect(await value('RETURN sign(0.0/0.0) AS x')).toEqual({ int: '0' });
  });
  it('R16: sign of floats keeps its integer result', async () => {
    expect(await value('RETURN sign(-2.5) AS x')).toEqual({ int: '-1' });
    expect(await value('RETURN sign(1.0/0.0) AS x')).toEqual({ int: '1' });
    expect(await value('RETURN sign(0.0) AS x')).toEqual({ int: '0' });
  });
  it('R16: toInteger(NaN) is 0, like a Java (long) cast', async () => {
    expect(await value('RETURN toInteger(0.0/0.0) AS x')).toEqual({ int: '0' });
  });
  it('R16: toInteger of an infinite or out-of-int64-range float saturates', async () => {
    expect(await value('RETURN toInteger(1.0/0.0) AS x')).toEqual({ int: INT64_MAX });
    expect(await value('RETURN toInteger(-1.0/0.0) AS x')).toEqual({ int: INT64_MIN });
    expect(await value('RETURN toInteger(1e19) AS x')).toEqual({ int: INT64_MAX });
    expect(await value('RETURN toInteger(-1e19) AS x')).toEqual({ int: INT64_MIN });
    expect(await value('RETURN toInteger(9223372036854775807.0) AS x')).toEqual({ int: INT64_MAX });
  });
  it('R16: toInteger of an in-range float still truncates toward zero', async () => {
    expect(await value('RETURN toInteger(-2.9) AS x')).toEqual({ int: '-2' });
    expect(await value('RETURN toInteger(2.9) AS x')).toEqual({ int: '2' });
    expect(await value('RETURN toInteger(-9.0e18) AS x')).toEqual({ int: '-9000000000000000000' });
  });
});
