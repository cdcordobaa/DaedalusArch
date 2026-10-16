/**
 * The interpreter's value model and the Neo4j 5 comparison semantics over it (Docs/v1.3/cypher-interpreter.md §3).
 *
 * - INTEGER is a `bigint` and FLOAT a `number`, so `1` and `1.0` stay distinct the way Neo4j keeps them distinct
 *   (`count(*)` is an INTEGER, a property written from a JS number by the driver is a FLOAT).
 * - LIST is a JS array, MAP a `CypherMap`, and graph entities are the store's own node / relationship objects plus
 *   `CypherPath`.
 * - Three comparison relations, as in Neo4j: equality (`=`, three-valued), comparability (`<`, three-valued, null
 *   across types) and orderability (ORDER BY, min/max: total, with a fixed order between types).
 */

export interface GraphNode {
  readonly kind: 'node';
  readonly id: number;
  readonly labels: ReadonlySet<string>;
  readonly properties: ReadonlyMap<string, Value>;
}

export interface GraphRel {
  readonly kind: 'rel';
  readonly id: number;
  readonly type: string;
  readonly start: GraphNode;
  readonly end: GraphNode;
  readonly properties: ReadonlyMap<string, Value>;
}

export class CypherMap {
  constructor(readonly entries: ReadonlyMap<string, Value>) {}
}

export class CypherPath {
  constructor(readonly nodes: readonly GraphNode[], readonly rels: readonly GraphRel[]) {}
}

export type Value = null | boolean | bigint | number | string | readonly Value[] | CypherMap | GraphNode | GraphRel | CypherPath;

/** A Cypher error raised at run time (a type error, a bad argument). Mirrors Neo4j's client errors. */
export class CypherRuntimeError extends Error {
  constructor(message: string, readonly code = 'Neo.ClientError.Statement.TypeError') {
    super(message);
    this.name = 'CypherRuntimeError';
  }
}

export const INT64_MIN = -(2n ** 63n);
export const INT64_MAX = 2n ** 63n - 1n;

export function checkedInt(v: bigint): bigint {
  if (v < INT64_MIN || v > INT64_MAX) throw new CypherRuntimeError('long overflow', 'Neo.ClientError.Statement.ArithmeticError');
  return v;
}

export function isNode(v: Value): v is GraphNode {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as { kind?: unknown }).kind === 'node';
}
export function isRel(v: Value): v is GraphRel {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && (v as { kind?: unknown }).kind === 'rel';
}
export function isList(v: Value): v is readonly Value[] {
  return Array.isArray(v);
}
export function isNumber(v: Value): v is bigint | number {
  return typeof v === 'bigint' || typeof v === 'number';
}

export function typeName(v: Value): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return 'Boolean';
  if (typeof v === 'bigint') return 'Long';
  if (typeof v === 'number') return 'Double';
  if (typeof v === 'string') return 'String';
  if (Array.isArray(v)) return 'List';
  if (v instanceof CypherMap) return 'Map';
  if (v instanceof CypherPath) return 'Path';
  if (isNode(v)) return 'Node';
  return 'Relationship';
}

/** Numeric comparison of two numbers of any kind, exact for integers beyond 2^53. NaN is unordered (returns NaN). */
function compareNumbers(a: bigint | number, b: bigint | number): number {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : a === b ? 0 : Number.NaN;
  const [i, f, sign] = typeof a === 'bigint' ? [a, b as number, 1] : [b as bigint, a, -1];
  if (Number.isNaN(f)) return Number.NaN;
  if (f === Infinity) return -sign;
  if (f === -Infinity) return sign;
  const fl = Math.floor(f);
  const fi = BigInt(fl);
  if (i < fi) return -sign;
  if (i > fi) return sign;
  return f > fl ? -sign : 0;
}

/**
 * Cypher equality (`=`): `null` when either side is null or when the answer depends on a null inside a list or map;
 * `false` across types (numbers compare across INTEGER and FLOAT).
 */
export function cypherEquals(a: Value, b: Value): boolean | null {
  if (a === null || b === null) return null;
  if (isNumber(a) && isNumber(b)) return compareNumbers(a, b) === 0;
  if (typeof a === 'string' || typeof a === 'boolean') return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    let sawNull = false;
    for (let i = 0; i < a.length; i++) {
      const e = cypherEquals(a[i] as Value, b[i] as Value);
      if (e === false) return false;
      if (e === null) sawNull = true;
    }
    return sawNull ? null : true;
  }
  if (a instanceof CypherMap) {
    if (!(b instanceof CypherMap)) return false;
    if (a.entries.size !== b.entries.size) return false;
    let sawNull = false;
    for (const [k, v] of a.entries) {
      if (!b.entries.has(k)) return false;
      const e = cypherEquals(v, b.entries.get(k) ?? null);
      if (e === false) return false;
      if (e === null) sawNull = true;
    }
    return sawNull ? null : true;
  }
  if (a instanceof CypherPath) {
    if (!(b instanceof CypherPath)) return false;
    return a.nodes.length === b.nodes.length && a.rels.length === b.rels.length
      && a.nodes.every((n, i) => n === b.nodes[i]) && a.rels.every((r, i) => r === b.rels[i]);
  }
  if (isNode(a)) return isNode(b) && a.id === b.id;
  if (isRel(a)) return isRel(b) && a.id === b.id;
  return false;
}

/**
 * Comparability (`<`, `<=`, `>`, `>=`): numbers with numbers, strings with strings, booleans with booleans, lists
 * lexicographically; anything else (or a null) is null.
 */
export function cypherCompare(a: Value, b: Value): number | null {
  if (a === null || b === null) return null;
  if (isNumber(a) && isNumber(b)) {
    const c = compareNumbers(a, b);
    return Number.isNaN(c) ? null : c;
  }
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const c = cypherCompare(a[i] as Value, b[i] as Value);
      if (c === null) return null;
      if (c !== 0) return c;
    }
    return a.length - b.length < 0 ? -1 : a.length > b.length ? 1 : 0;
  }
  return null;
}

/** The ORDER BY rank of a value's type (Neo4j 5 orderability, ascending; null last). */
function orderRank(v: Value): number {
  if (v === null) return 9;
  if (v instanceof CypherMap) return 0;
  if (isNode(v)) return 1;
  if (isRel(v)) return 2;
  if (Array.isArray(v)) return 3;
  if (v instanceof CypherPath) return 4;
  if (typeof v === 'string') return 5;
  if (typeof v === 'boolean') return 6;
  return 7; // numbers
}

/** Total orderability (ORDER BY, min, max): types by rank, then within the type; NaN after every other number. */
export function cypherOrder(a: Value, b: Value): number {
  const ra = orderRank(a);
  const rb = orderRank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  switch (ra) {
    case 9: return 0;
    case 7: {
      const x = a as bigint | number;
      const y = b as bigint | number;
      const xn = typeof x === 'number' && Number.isNaN(x);
      const yn = typeof y === 'number' && Number.isNaN(y);
      if (xn || yn) return xn && yn ? 0 : xn ? 1 : -1;
      return compareNumbers(x, y);
    }
    case 5: return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
    case 6: return a === b ? 0 : a ? 1 : -1;
    case 3: {
      const x = a as readonly Value[];
      const y = b as readonly Value[];
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) {
        const c = cypherOrder(x[i] as Value, y[i] as Value);
        if (c !== 0) return c;
      }
      return x.length < y.length ? -1 : x.length > y.length ? 1 : 0;
    }
    case 1: case 2: {
      const x = (a as GraphNode | GraphRel).id;
      const y = (b as GraphNode | GraphRel).id;
      return x < y ? -1 : x > y ? 1 : 0;
    }
    case 4: {
      const x = a as CypherPath;
      const y = b as CypherPath;
      const xs: Value[] = []; const ys: Value[] = [];
      x.nodes.forEach((n, i) => { xs.push(n); const r = x.rels[i]; if (r !== undefined) xs.push(r); });
      y.nodes.forEach((n, i) => { ys.push(n); const r = y.rels[i]; if (r !== undefined) ys.push(r); });
      return cypherOrder(xs, ys);
    }
    default: {
      // maps: by sorted keys, then values
      const x = a as CypherMap;
      const y = b as CypherMap;
      const xk = [...x.entries.keys()].sort();
      const yk = [...y.entries.keys()].sort();
      const c = cypherOrder(xk, yk);
      if (c !== 0) return c;
      return cypherOrder(xk.map((k) => x.entries.get(k) ?? null), yk.map((k) => y.entries.get(k) ?? null));
    }
  }
}

/**
 * Equivalence key (grouping, DISTINCT, `count(DISTINCT)`, `apoc.coll.toSet`): two values share a key exactly when
 * Neo4j treats them as the same group. Numbers are equivalent across INTEGER and FLOAT (`1` groups with `1.0`), null
 * groups with null.
 */
export function equivalenceKey(v: Value): string {
  if (v === null) return 'z';
  if (typeof v === 'boolean') return v ? 'bt' : 'bf';
  if (typeof v === 'bigint') return `n${v.toString()}`;
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return `n${BigInt(v).toString()}`;
    if (Number.isNaN(v)) return 'nNaN';
    return `n${String(v)}`;
  }
  if (typeof v === 'string') return `s${JSON.stringify(v)}`;
  if (Array.isArray(v)) return `l[${v.map((e) => equivalenceKey(e as Value)).join(',')}]`;
  if (v instanceof CypherMap) return `m{${[...v.entries.keys()].sort().map((k) => `${JSON.stringify(k)}:${equivalenceKey(v.entries.get(k) ?? null)}`).join(',')}}`;
  if (v instanceof CypherPath) return `p(${v.nodes.map((n) => String(n.id)).join(',')}|${v.rels.map((r) => String(r.id)).join(',')})`;
  if (isNode(v)) return `N${String(v.id)}`;
  return `R${String((v as GraphRel).id)}`;
}

/** Java `Double.toString`, which Neo4j uses for `toString(float)` and for string concatenation with a float. */
export function javaDoubleToString(d: number): string {
  if (Number.isNaN(d)) return 'NaN';
  if (d === Infinity) return 'Infinity';
  if (d === -Infinity) return '-Infinity';
  if (d === 0) return Object.is(d, -0) ? '-0.0' : '0.0';
  const abs = Math.abs(d);
  if (abs >= 1e-3 && abs < 1e7) {
    const s = String(d);
    return s.includes('.') ? s : `${s}.0`;
  }
  // Scientific: shortest digits, Java style mantissa `d.ddd` and exponent `E[-]n`.
  const [mant = '', exp = '0'] = d.toExponential().split('e');
  const m = mant.includes('.') ? mant : `${mant}.0`;
  return `${m}E${String(Number(exp))}`;
}

/** `toString` / string-concatenation text of a scalar, as Neo4j renders it. */
export function scalarToString(v: Value): string {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return javaDoubleToString(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v;
  throw new CypherRuntimeError(`Cannot convert ${typeName(v)} to a string`);
}
