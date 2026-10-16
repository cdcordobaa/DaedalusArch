/**
 * The slice of Neo4j's semantic analysis the interpreter needs since it iterates non-lists (fuzz finding F3): Neo4j
 * 5.26.24 treats a runtime non-list as a one-element list in `IN`, the quantifiers, list comprehensions, `reduce`,
 * `tail` and slicing, but rejects the query at compile time (`Neo.ClientError.Statement.SyntaxError`, "Type mismatch:
 * expected List<T> but was …") when the operand's static type is known not to be a list. Known here: scalar and map
 * literals, node, relationship and path variables of a pattern, and variables a WITH / RETURN projects from them.
 * Everything else (properties, parameters, functions, UNWIND variables) is unknown and checked at run time.
 *
 * The same pass resolves every variable and function name (fuzz finding F9): Neo4j rejects `Variable \`x\` not
 * defined` and unknown functions when planning, whatever the data; evaluated lazily, the interpreter returned zero
 * rows for such a query whenever no row reached the expression. An unknown name is a syntax error, a function Neo4j
 * has but the interpreter does not implement is `CypherUnsupportedError`, both before any row is read.
 */
import type { Clause, Expr, PatternPart, Query } from './ast.js';
import { CypherSyntaxError, CypherUnsupportedError } from './parse.js';
import { AGGREGATES, lookupFunction } from './functions.js';

type Static = 'list' | 'nonList' | 'unknown';
type Scope = ReadonlyMap<string, Static>;

export function checkStaticTypes(q: Query, outer: Scope = new Map()): void {
  let scope = new Map(outer);
  for (const c of q.clauses) scope = clauseScope(c, scope);
}

function clauseScope(c: Clause, scope: Map<string, Static>): Map<string, Static> {
  switch (c.k) {
    case 'match': {
      const next = new Map(scope);
      for (const p of c.patterns) bindPattern(p, next);
      for (const p of c.patterns) {
        for (const n of p.nodes) { if (n.properties !== undefined) check(n.properties, next); if (n.where !== undefined) check(n.where, next); }
        for (const r of p.rels) { if (r.properties !== undefined) check(r.properties, next); if (r.where !== undefined) check(r.where, next); }
      }
      if (c.where !== undefined) check(c.where, next);
      return next;
    }
    case 'unwind': {
      check(c.expr, scope);
      return new Map(scope).set(c.alias, 'unknown');
    }
    case 'with':
    case 'return': {
      const p = c.projection;
      for (const i of p.items) check(i.expr, scope);
      const next = new Map<string, Static>(p.star ? scope : []);
      for (const i of p.items) next.set(i.alias, staticType(i.expr, scope));
      // ORDER BY may read both the projected aliases and the incoming variables.
      const both = new Map([...scope, ...next]);
      for (const s of p.orderBy) check(s.expr, both);
      if (p.skip !== undefined) check(p.skip, scope);
      if (p.limit !== undefined) check(p.limit, scope);
      if (c.k === 'with' && c.where !== undefined) check(c.where, next);
      return next;
    }
  }
}

function bindPattern(p: PatternPart, scope: Map<string, Static>): void {
  if (p.pathVariable !== undefined) scope.set(p.pathVariable, 'nonList');
  for (const n of p.nodes) if (n.variable !== undefined) scope.set(n.variable, 'nonList');
  for (const r of p.rels) if (r.variable !== undefined) scope.set(r.variable, r.range === undefined ? 'nonList' : 'list');
}

function staticType(e: Expr, scope: Scope): Static {
  switch (e.k) {
    case 'lit': return e.v === null ? 'unknown' : Array.isArray(e.v) ? 'list' : 'nonList';
    case 'map': return 'nonList';
    case 'list': case 'listComp': return 'list';
    case 'var': return scope.get(e.name) ?? 'unknown';
    default: return 'unknown';
  }
}

function iterated(e: Expr, scope: Scope): void {
  if (staticType(e, scope) === 'nonList') throw new CypherSyntaxError('Type mismatch: expected List<T> but was not a list');
}

/** Checks every iterated operand in `e`, with the scope the comprehension and quantifier variables extend. */
function check(e: Expr, scope: Scope): void {
  switch (e.k) {
    case 'bin':
      if (e.op === 'IN') iterated(e.r, scope);
      check(e.l, scope);
      check(e.r, scope);
      return;
    case 'listComp': case 'quant': {
      iterated(e.list, scope);
      check(e.list, scope);
      const inner = new Map(scope).set(e.v, 'unknown');
      if (e.where !== undefined) check(e.where, inner);
      if (e.k === 'listComp' && e.map !== undefined) check(e.map, inner);
      return;
    }
    case 'reduce': {
      iterated(e.list, scope);
      check(e.list, scope);
      check(e.init, scope);
      check(e.expr, new Map(scope).set(e.acc, 'unknown').set(e.v, 'unknown'));
      return;
    }
    case 'slice':
      iterated(e.obj, scope);
      check(e.obj, scope);
      if (e.from !== undefined) check(e.from, scope);
      if (e.to !== undefined) check(e.to, scope);
      return;
    case 'fn':
      if (!AGGREGATES.has(e.name.toLowerCase()) && lookupFunction(e.name) === undefined) throw new CypherUnsupportedError(`function ${e.name}()`);
      checkArity(e.name, e.args.length);
      if (e.name.toLowerCase() === 'tail' && e.args[0] !== undefined) iterated(e.args[0], scope);
      for (const a of e.args) check(a, scope);
      return;
    case 'exists':
      checkStaticTypes(e.query, scope);
      return;
    case 'prop': check(e.obj, scope); return;
    case 'index': check(e.obj, scope); check(e.idx, scope); return;
    case 'list': for (const i of e.items) check(i, scope); return;
    case 'map': for (const [, v] of e.entries) check(v, scope); return;
    case 'not': case 'neg': case 'isNull': case 'hasLabel': check(e.e, scope); return;
    case 'case':
      if (e.subject !== undefined) check(e.subject, scope);
      for (const [w, t] of e.whens) { check(w, scope); check(t, scope); }
      if (e.otherwise !== undefined) check(e.otherwise, scope);
      return;
    case 'var':
      if (!scope.has(e.name)) throw new CypherSyntaxError(`Variable \`${e.name}\` not defined`);
      return;
    case 'lit': case 'param': case 'countStar':
      return;
  }
}

/** Argument counts of the supported functions, checked when planning as Neo4j does (`Insufficient parameters`). */
const ARITY = new Map<string, readonly [number, number]>([
  ...['type', 'labels', 'id', 'keys', 'nodes', 'relationships', 'startnode', 'endnode', 'length', 'size', 'head', 'last', 'tail', 'reverse',
    'isempty', 'tolower', 'toupper', 'trim', 'ltrim', 'rtrim', 'tostring', 'tointeger', 'tofloat', 'toboolean', 'abs', 'sign', 'ceil', 'floor',
    'sqrt', 'apoc.coll.toset', 'apoc.coll.sort', 'count', 'collect', 'sum', 'avg', 'min', 'max'].map((n): [string, readonly [number, number]] => [n, [1, 1]]),
  ['range', [2, 3]], ['split', [2, 2]], ['substring', [2, 3]], ['left', [2, 2]], ['right', [2, 2]], ['replace', [3, 3]], ['apoc.coll.indexof', [2, 2]],
  ['coalesce', [1, Infinity]],
]);

function checkArity(name: string, n: number): void {
  const a = ARITY.get(name.toLowerCase());
  if (a === undefined) return;
  if (n < a[0]) throw new CypherSyntaxError(`Insufficient parameters for function '${name}'`);
  if (n > a[1]) throw new CypherSyntaxError(`Too many parameters for function '${name}'`);
}
