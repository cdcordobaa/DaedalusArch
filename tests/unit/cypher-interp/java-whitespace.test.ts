/**
 * R18 (Docs/v1.3/post-merge-review-2026-10-16.md): trim/ltrim/rtrim and the string branches of toInteger/toFloat strip
 * Java `Character.isWhitespace` code points (Unicode Zs/Zl/Zp minus the no-break spaces U+00A0, U+2007, U+202F, plus
 * U+0009-U+000D and U+001C-U+001F), not JavaScript's `String.prototype.trim` set.
 */
import neo4j from 'neo4j-driver';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { lookupFunction } from '../../../src/cypher-interp/functions.js';

const repo = new MemoryGraphRepository();

async function value(cypher: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const r = await repo.executeQuery(cypher, params);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  const v = Object.values(r.data.records[0] ?? {})[0];
  return neo4j.isInt(v) ? { int: (v as { toString(): string }).toString() } : v;
}

/**
 * `trim(x)` is its own production in the Cypher 25 grammar (`trimFunction`), which the parser rejects as unsupported;
 * the built-in is exercised directly so its semantics are right if the production is ever admitted.
 */
function trim(s: string): unknown {
  const fn = lookupFunction('trim');
  if (fn === undefined) throw new Error('no trim built-in');
  return fn([s]);
}

/** Characters by code point (kept as numbers so the source stays ASCII). */
const c = (...cps: number[]): string => String.fromCodePoint(...cps);
const NBSP = c(0xa0);
const FIGURE_SPACE = c(0x2007);
const NARROW_NBSP = c(0x202f);
const BOM = c(0xfeff);

describe('cypher-interp: Java whitespace in trim and number parsing (R18)', () => {
  it('R18: trim keeps the no-break spaces U+00A0, U+2007, U+202F and U+FEFF', async () => {
    expect(trim(`${NBSP}Order`)).toBe(`${NBSP}Order`);
    expect(trim(`${FIGURE_SPACE}Order${NARROW_NBSP}`)).toBe(`${FIGURE_SPACE}Order${NARROW_NBSP}`);
    expect(trim(`${BOM}Order`)).toBe(`${BOM}Order`);
    expect(await value('RETURN ltrim($s) AS x', { s: `${NBSP}Order` })).toBe(`${NBSP}Order`);
    expect(await value('RETURN rtrim($s) AS x', { s: `Order${NARROW_NBSP}` })).toBe(`Order${NARROW_NBSP}`);
  });
  it('R18: trim strips U+001C-U+001F, which JavaScript keeps', async () => {
    expect(trim(`${c(0x1f)}X${c(0x1c)}`)).toBe('X');
    expect(await value('RETURN ltrim($s) AS x', { s: `${c(0x1f)}X` })).toBe('X');
    expect(await value('RETURN rtrim($s) AS x', { s: `X${c(0x1c)}` })).toBe('X');
  });
  it('R18: trim, ltrim and rtrim strip ASCII controls, Zs, Zl and Zp', async () => {
    const lead = ` \t\n${c(0x0b)}\f\r${c(0x2003, 0x2028, 0x2029, 0x3000)}`;
    const tail = `${c(0x1680, 0x205f)} \r\n`;
    const s = `${lead}a b${tail}`;
    expect(trim(s)).toBe('a b');
    expect(await value('RETURN ltrim($s) AS x', { s })).toBe(`a b${tail}`);
    expect(await value('RETURN rtrim($s) AS x', { s })).toBe(`${lead}a b`);
    expect(await value('RETURN ltrim($s) AS x', { s: `${NBSP} a` })).toBe(`${NBSP} a`);
    expect(await value('RETURN rtrim($s) AS x', { s: `a ${NBSP}` })).toBe(`a ${NBSP}`);
  });
  it('R18: toInteger and toFloat do not strip a no-break space, and do strip U+001F', async () => {
    expect(await value('RETURN toInteger($s) AS x', { s: `${NBSP}12` })).toBe(null);
    expect(await value('RETURN toInteger($s) AS x', { s: `1.5${NBSP}` })).toBe(null);
    expect(await value('RETURN toFloat($s) AS x', { s: `${NBSP}1.5` })).toBe(null);
    expect(await value('RETURN toInteger($s) AS x', { s: `${c(0x1f)}12 ` })).toEqual({ int: '12' });
    expect(await value('RETURN toInteger($s) AS x', { s: ` 2.7${c(0x1e)}` })).toEqual({ int: '2' });
    expect(await value('RETURN toFloat($s) AS x', { s: ` 1.5${c(0x1c)}` })).toBe(1.5);
  });
});
