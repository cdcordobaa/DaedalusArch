/**
 * The boolean simplifications Neo4j 5.26.24's planner applies before evaluating anything (fuzz finding F6). They are
 * visible because Neo4j does not coerce what it simplifies away: `x AND true` is `x` (a list or a string comes back
 * as is), `x AND false` is `false` even when `x` would raise a type error. Applied bottom-up, measured live:
 * - `NOT true` / `NOT false` fold; `NOT NOT x` is `x`;
 * - `x AND false`, `false AND x` are `false`; `x AND true`, `true AND x` are `x`;
 * - `x OR true`, `true OR x` are `true`; `x OR false`, `false OR x` are `x`;
 * - `x XOR false`, `false XOR x` are `x` (`XOR true` is not simplified);
 * - a comparison of two number literals folds (`1 < 2`, `1 = 1.0`); a comparison of strings or booleans, `IN`, and
 *   `null` operands do not.
 */
import type { Expr, Query } from './ast.js';
import { cypherCompare, cypherEquals } from './values.js';

export function simplifyQuery(q: Query): Query {
  return mapNode(q) as Query;
}

/** Rebuilds the AST bottom-up, simplifying every expression; a literal's value is never entered. */
function mapNode(n: unknown): unknown {
  if (Array.isArray(n)) return n.map(mapNode);
  if (typeof n !== 'object' || n === null || Object.getPrototypeOf(n) !== Object.prototype) return n;
  const o = n as Record<string, unknown>;
  if (o.k === 'lit') return n;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(o)) out[key] = mapNode(v);
  return typeof o.k === 'string' ? simplify(out as Expr) : out;
}

const isBool = (e: Expr, b: boolean): boolean => e.k === 'lit' && e.v === b;
const lit = (v: boolean): Expr => ({ k: 'lit', v });

function simplify(e: Expr): Expr {
  if (e.k === 'not') {
    if (e.e.k === 'lit' && typeof e.e.v === 'boolean') return lit(!e.e.v);
    if (e.e.k === 'not') return e.e.e;
    return e;
  }
  if (e.k !== 'bin') return e;
  const { op, l, r } = e;
  switch (op) {
    case 'AND':
      if (isBool(l, false) || isBool(r, false)) return lit(false);
      if (isBool(l, true)) return r;
      if (isBool(r, true)) return l;
      return e;
    case 'OR':
      if (isBool(l, true) || isBool(r, true)) return lit(true);
      if (isBool(l, false)) return r;
      if (isBool(r, false)) return l;
      return e;
    case 'XOR':
      if (isBool(l, false)) return r;
      if (isBool(r, false)) return l;
      return e;
    case '=': case '<>': case '<': case '>': case '<=': case '>=': {
      if (l.k !== 'lit' || r.k !== 'lit' || !isNum(l.v) || !isNum(r.v)) return e;
      if (op === '=' || op === '<>') {
        const eq = cypherEquals(l.v, r.v);
        return eq === null ? e : lit(op === '=' ? eq : !eq);
      }
      const c = cypherCompare(l.v, r.v);
      if (c === null) return e;
      return lit(op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0);
    }
    default:
      return e;
  }
}

function isNum(v: unknown): boolean {
  return typeof v === 'bigint' || (typeof v === 'number' && !Number.isNaN(v));
}
