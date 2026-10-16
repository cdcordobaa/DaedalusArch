/**
 * Executes a parsed read query over a `MemoryGraph` (Docs/v1.3/cypher-interpreter.md §2-3).
 *
 * Rows stream through the clauses as generators, so `EXISTS { }` stops at its first row. MATCH binds patterns with
 * Neo4j's relationship isomorphism (no relationship twice within one MATCH clause, variable-length segments included);
 * nodes may repeat. Grouping, DISTINCT and the aggregates follow Neo4j 5.26's runtime: groups and DISTINCT rows in
 * first-seen order, `avg` as the incremental mean `m += (x - m) / n` (bit-for-bit what 5.26.24 returns), `sum` in row
 * order, `min`/`max` by orderability.
 */
import type { Clause, Expr, LabelExpr, NodePattern, PatternPart, Projection, Query, RelPattern } from './ast.js';
import { AGGREGATES, javaRegex, lookupFunction } from './functions.js';
import type { MemoryGraph } from './graph.js';
import { CypherSyntaxError, CypherUnsupportedError } from './parse.js';
import {
  CypherMap, CypherPath, CypherRuntimeError, checkedInt, cypherCompare, cypherEquals, cypherOrder, equivalenceKey, isList, isNode, isNumber, isRel,
  scalarToString, typeName,
} from './values.js';
import type { GraphNode, GraphRel, Value } from './values.js';

export type Row = ReadonlyMap<string, Value>;

/**
 * Data errors (type, arithmetic) the interpreter held back and then dropped because the predicate's outcome did not
 * depend on them (see `predicateHolds`), by Neo4j status code. Diagnostics only: the fuzz harness reads it to tell a
 * plan-order difference (Neo4j raised an error the interpreter could prove irrelevant, trap T20) from a missed error.
 * With `enabled`, a WHERE also evaluates the conjuncts after the first false one, only to count their errors.
 */
export const evalDiagnostics = { suppressed: new Map<string, number>(), enabled: false, strict: false };

/**
 * Drops a held-back data error. In `strict` mode (diagnostics only, never in a normal run) it is raised instead, the
 * anchor pre-filter raises its conjuncts' errors and prunes nothing, and every pattern predicate is first evaluated over every relationship of its types: the
 * interpreter then fails iff some evaluation order reaches a data error, which is how the fuzz harness tells Neo4j
 * reaching one in its plan's order (trap T20) from an error the interpreter misses.
 */
function suppress(err: CypherRuntimeError): void {
  if (evalDiagnostics.strict) throw err;
  evalDiagnostics.suppressed.set(err.code, (evalDiagnostics.suppressed.get(err.code) ?? 0) + 1);
}

/** Strict mode: every pattern predicate of a MATCH over every relationship of its types (see `suppress`). */
function strictScan(clause: Extract<Clause, { k: 'match' }>, pushed: ReadonlyMap<RelPattern, Pushdown>, row: Row, ctx: Ctx): void {
  const attempt = (e: Expr, r: Row): void => {
    try {
      predicate(e, r, ctx, 'WHERE');
    } catch (err) {
      if (err instanceof CypherSyntaxError) return; // reads a variable not bound at this point
      throw err;
    }
  };
  for (const part of clause.patterns) {
    for (const rel of part.rels) {
      const quants = [...(pushed.get(rel)?.rels ?? [])];
      if (quants.length === 0 && (rel.where === undefined || rel.variable === undefined)) continue;
      for (const r of ctx.graph.relationships) {
        if (rel.types !== undefined && !labelMatches(rel.types, (l) => r.type === l)) continue;
        if (rel.where !== undefined && rel.variable !== undefined) attempt(rel.where, bind(row, rel.variable, r));
        for (const q of quants) if (q.where !== undefined) attempt(q.where, bind(row, q.v, r));
      }
    }
  }
}

interface Ctx {
  readonly graph: MemoryGraph;
  readonly params: ReadonlyMap<string, Value>;
  /** Aggregate results of the group being projected, by AST node. */
  readonly aggregates?: ReadonlyMap<Expr, Value>;
  /** Set while evaluating an `EXISTS { }` made of MATCH clauses only: only whether a row exists matters. */
  readonly existential?: boolean;
  /** Per variable-length relationship pattern of the current MATCH: the pushed-down filters (see `pushdowns`). */
  readonly pushed?: ReadonlyMap<RelPattern, Pushdown>;
  /** The current MATCH's WHERE conjuncts with the variables they read (see `matchPart`). */
  readonly early?: readonly { readonly expr: Expr; readonly vars: ReadonlySet<string> }[];
  /** Existential MATCH only: the first data error a pushed-down filter raised, held back (see `rejects`). */
  readonly held?: { err?: CypherRuntimeError };
}

/**
 * Filters of a MATCH's WHERE applied inside a variable-length expansion instead of after it, as Neo4j's planner does
 * (fuzz finding F2): a conjunct `ALL(x IN r WHERE p)` over the segment's relationship list, or `ALL(x IN
 * relationships(path) WHERE p)` / `ALL(x IN nodes(path) WHERE p)` for a path made of that one segment, prunes every
 * partial path at the first node or relationship for which `p` is not true (nodes are checked first, F4); `NONE(…)`
 * likewise where `p` is not false (F7: the exclude form of no-cyclic-deps). The conjunct stays in the WHERE, so the rows are unchanged; only the enumeration of
 * paths the WHERE would reject is skipped. `reach`: the segment sits in an existential MATCH (see `Ctx.existential`)
 * and only its end nodes matter, so it is a breadth-first reachability search (each end node once) rather than an
 * enumeration of every trail.
 */
interface Pushdown {
  readonly rels: readonly Extract<Expr, { k: 'quant' }>[];
  readonly nodes: readonly Extract<Expr, { k: 'quant' }>[];
  readonly reach: boolean;
}

export interface QueryOutput {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Value[])[];
}

export function executeQuery(query: Query, graph: MemoryGraph, params: ReadonlyMap<string, Value>): QueryOutput {
  const ctx: Ctx = { graph, params };
  const last = query.clauses[query.clauses.length - 1];
  if (last?.k !== 'return') throw new CypherSyntaxError('Query cannot conclude with ' + (last?.k.toUpperCase() ?? 'nothing') + ' (must be a RETURN clause)');
  const rows: (readonly Value[])[] = [];
  let columns: string[] = [];
  for (const row of runClauses(query.clauses, [new Map()], ctx)) {
    if (columns.length === 0) columns = [...row.keys()];
    rows.push(columns.map((c) => row.get(c) ?? null));
  }
  if (columns.length === 0) columns = returnColumns(last.projection);
  return { columns, rows };
}

function returnColumns(p: Projection): string[] {
  return p.items.map((i) => i.alias);
}

function* runClauses(clauses: readonly Clause[], input: Iterable<Row>, ctx: Ctx): Generator<Row> {
  let rows: Iterable<Row> = input;
  for (const clause of clauses) rows = runClause(clause, rows, ctx);
  yield* rows;
}

function runClause(clause: Clause, rows: Iterable<Row>, ctx: Ctx): Iterable<Row> {
  switch (clause.k) {
    case 'match': return matchClause(clause, rows, ctx);
    case 'unwind': return unwind(clause.expr, clause.alias, rows, ctx);
    case 'with': {
      const projected = project(clause.projection, rows, ctx);
      const where = clause.where;
      return where === undefined ? projected : filter(projected, where, ctx);
    }
    case 'return': return project(clause.projection, rows, ctx);
  }
}

function* filter(rows: Iterable<Row>, where: Expr, ctx: Ctx): Generator<Row> {
  for (const r of rows) if (predicateHolds(where, r, ctx)) yield r;
}

/**
 * A WHERE as Neo4j filters with it: its top-level conjuncts are separate predicates, evaluated in the planner's order
 * and stopping at the first that is not true, so a data error in one conjunct surfaces only when every other conjunct
 * is true (fuzz finding F1; a false or a null conjunct both reject the row). `pending` is an error already raised by an
 * inline pattern predicate of the same MATCH.
 */
function predicateHolds(where: Expr | undefined, row: Row, ctx: Ctx, pending?: CypherRuntimeError): boolean {
  let err = pending;
  const cs = conjuncts(where);
  for (const [i, c0] of cs.entries()) {
    const ok = tryPredicate(c0, row, ctx);
    if (ok === false) {
      if (err !== undefined) suppress(err);
      if (evalDiagnostics.enabled) {
        for (const c of cs.slice(i + 1)) {
          const later = tryPredicate(c, row, ctx);
          if (later instanceof CypherRuntimeError) suppress(later);
        }
      }
      return false;
    }
    if (ok !== true) err ??= ok;
  }
  if (err !== undefined) throw err;
  return true;
}

function* unwind(expr: Expr, alias: string, rows: Iterable<Row>, ctx: Ctx): Generator<Row> {
  for (const r of rows) {
    const v = evaluate(expr, r, ctx);
    if (v === null) continue;
    const items = isList(v) ? v : [v];
    for (const item of items) yield bind(r, alias, item);
  }
}

function bind(r: Row, name: string, v: Value): Row {
  const m = new Map(r);
  m.set(name, v);
  return m;
}

// ── MATCH ──

function patternVariables(parts: readonly PatternPart[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (p.pathVariable !== undefined) out.push(p.pathVariable);
    for (const n of p.nodes) if (n.variable !== undefined) out.push(n.variable);
    for (const r of p.rels) if (r.variable !== undefined) out.push(r.variable);
  }
  return out;
}

/**
 * Neo4j plans a MATCH's inline `WHERE`s (node and relationship patterns) and its `WHERE` as one conjunction and
 * evaluates it in the planner's order, so a data error in one conjunct surfaces only when no other conjunct rejects the
 * row (fuzz finding F1: `-[i WHERE NOT i.flag]->` on a string `flag` is no error when `WHERE src.layer IS NOT NULL`
 * already fails). An inline predicate's error is therefore carried with the partial match under `PENDING` and raised
 * only if the rest of the conjunction holds.
 */
const PENDING = '\u0000pending-error';

function withPending(row: Row, err: CypherRuntimeError): Row {
  return row.has(PENDING) ? row : bind(row, PENDING, err as unknown as Value);
}

function* matchClause(clause: Extract<Clause, { k: 'match' }>, rows: Iterable<Row>, ctx0: Ctx): Generator<Row> {
  const pushed = pushdowns(clause, ctx0.existential === true);
  const early = conjuncts(clause.where).flatMap((expr) => {
    const vars = varsOf(expr);
    return vars === undefined ? [] : [{ expr, vars }];
  });
  const ctx: Ctx = {
    graph: ctx0.graph, params: ctx0.params, ...(ctx0.aggregates !== undefined ? { aggregates: ctx0.aggregates } : {}), ...(pushed.size > 0 ? { pushed } : {}),
    ...(early.length > 0 ? { early } : {}), ...(ctx0.existential === true && !evalDiagnostics.strict ? { held: {} } : {}),
  };
  // In an existential MATCH a row's data error is held back (F8): EXISTS is true as soon as any row qualifies, in
  // whatever order Neo4j finds them, so the error is raised only if the match runs out of rows without one.
  let held: CypherRuntimeError | undefined;
  let done = false;
  try {
    for (const r of rows) {
      if (evalDiagnostics.strict) strictScan(clause, pushed, r, ctx);
      let any = false;
      for (const m0 of matchParts(clause.patterns, 0, r, new Set(), ctx)) {
        const pending = m0.get(PENDING) as unknown as CypherRuntimeError | undefined;
        let m = m0;
        if (pending !== undefined) {
          const copy = new Map(m0);
          copy.delete(PENDING);
          m = copy;
        }
        let holds: boolean;
        try {
          holds = predicateHolds(clause.where, m, ctx, pending);
        } catch (e) {
          if (ctx0.existential !== true || evalDiagnostics.strict || !(e instanceof CypherRuntimeError)) throw e;
          held ??= e;
          continue;
        }
        if (!holds) continue;
        any = true;
        yield m;
      }
      if (!any && clause.optional) {
        const out = new Map(r);
        for (const v of patternVariables(clause.patterns)) if (!out.has(v)) out.set(v, null);
        yield out;
      }
    }
    done = true;
    held ??= ctx.held?.err;
  } finally {
    if (!done && ctx.held?.err !== undefined) suppress(ctx.held.err);
    // Stopped early: a row qualified, the held error did not matter.
    if (!done && held !== undefined) suppress(held);
  }
  if (held !== undefined) throw held;
}

function conjuncts(e: Expr | undefined): Expr[] {
  if (e === undefined) return [];
  return e.k === 'bin' && e.op === 'AND' ? [...conjuncts(e.l), ...conjuncts(e.r)] : [e];
}

function pushdowns(clause: Extract<Clause, { k: 'match' }>, existential: boolean): Map<RelPattern, Pushdown> {
  const out = new Map<RelPattern, Pushdown>();
  const relCount = clause.patterns.reduce((n, p) => n + p.rels.length, 0);
  const cs = conjuncts(clause.where);
  for (const part of clause.patterns) {
    for (const rel of part.rels) {
      if (rel.range === undefined) continue;
      const quants = cs.filter((c): c is Extract<Expr, { k: 'quant' }> => c.k === 'quant' && (c.q === 'all' || c.q === 'none') && c.where !== undefined && !hasSubquery(c.where));
      const ofPath = (fn: string) => (c: Extract<Expr, { k: 'quant' }>): boolean => part.pathVariable !== undefined && part.rels.length === 1 && c.list.k === 'fn'
        && c.list.name.toLowerCase() === fn && c.list.args.length === 1 && c.list.args[0]?.k === 'var' && c.list.args[0].name === part.pathVariable;
      const rels = quants.filter((c) => (rel.variable !== undefined && c.list.k === 'var' && c.list.name === rel.variable) || ofPath('relationships')(c));
      const nodes = quants.filter(ofPath('nodes'));
      // Reachability is exact for a directed segment with no variable, no path variable, no other relationship in the
      // clause (isomorphism), at least 0..1 and no upper bound: a trail of length >= 1 exists iff a walk does.
      const reach = existential && relCount === 1 && rel.variable === undefined && part.pathVariable === undefined && rel.direction !== 'both'
        && rel.range.min <= 1 && rel.range.max === undefined;
      if (rels.length > 0 || nodes.length > 0 || reach) out.set(rel, { rels, nodes, reach });
    }
  }
  return out;
}

/** Whether an expression holds an `EXISTS { }` (whose variables a pushed-down filter could not see). */
function hasSubquery(e: Expr): boolean {
  if (e.k === 'exists') return true;
  return Object.values(e).some((v) => {
    if (Array.isArray(v)) return v.some((x) => (Array.isArray(x) ? x.some((y) => isExpr(y) && hasSubquery(y)) : isExpr(x) && hasSubquery(x)));
    return isExpr(v) && hasSubquery(v);
  });
}

/** The variables an expression reads (minus those its own comprehensions bind); undefined if it holds a subquery. */
function varsOf(e: Expr): Set<string> | undefined {
  if (hasSubquery(e)) return undefined;
  const out = new Set<string>();
  const walk = (x: Expr, bound: ReadonlySet<string>): void => {
    switch (x.k) {
      case 'var': if (!bound.has(x.name)) out.add(x.name); return;
      case 'listComp': case 'quant': {
        walk(x.list, bound);
        const inner = new Set(bound).add(x.v);
        if (x.where !== undefined) walk(x.where, inner);
        if (x.k === 'listComp' && x.map !== undefined) walk(x.map, inner);
        return;
      }
      case 'reduce':
        walk(x.list, bound);
        walk(x.init, bound);
        walk(x.expr, new Set(bound).add(x.acc).add(x.v));
        return;
      default:
        for (const v of Object.values(x)) {
          if (Array.isArray(v)) for (const y of v) { if (Array.isArray(y)) { for (const z of y) if (isExpr(z)) walk(z, bound); } else if (isExpr(y)) walk(y, bound); }
          else if (isExpr(v)) walk(v, bound);
        }
    }
  };
  walk(e, new Set());
  return out;
}

function isExpr(v: unknown): v is Expr {
  return typeof v === 'object' && v !== null && 'k' in v && typeof v.k === 'string';
}

/**
 * Whether a pushed-down filter rejects `x` (its predicate is false or null). A data error is raised at once, as Neo4j
 * raises it from inside the expansion it pushed the predicate into (`ALL(r IN rels WHERE NOT r.flag)` on a string
 * `flag` fails before any path is complete); deferring it would enumerate every path only to raise it at the end.
 * Inside an `EXISTS` it is held back instead (F10), like a row's error (F8): another path may still qualify.
 */
function rejects(q: Extract<Expr, { k: 'quant' }>, x: Value, row: Row, ctx: Ctx): boolean {
  const where = q.where;
  if (where === undefined) return false;
  let v: boolean | null;
  try {
    v = predicate(where, bind(row, q.v, x), ctx, 'WHERE');
  } catch (e) {
    // A variable the predicate reads is not bound yet at this point of the expansion: do not push it.
    if (e instanceof CypherSyntaxError) return false;
    // In an existential MATCH another path may still qualify (F10): prune this one and hold the error back.
    if (ctx.held !== undefined && e instanceof CypherRuntimeError) {
      ctx.held.err ??= e;
      return true;
    }
    throw e;
  }
  // ALL needs p true for every element, NONE needs it false: anything else makes the quantifier false or null.
  return q.q === 'none' ? v !== false : v !== true;
}

function* matchParts(parts: readonly PatternPart[], i: number, row: Row, used: ReadonlySet<GraphRel>, ctx: Ctx): Generator<Row> {
  const part = parts[i];
  if (part === undefined) {
    yield row;
    return;
  }
  for (const [r, u] of matchPart(part, row, used, ctx)) yield* matchParts(parts, i + 1, r, u, ctx);
}

/** One step of a bound path: the relationships of a segment (one, or a variable-length list) and the node reached. */
interface Segment {
  readonly rels: readonly GraphRel[];
  readonly node: GraphNode;
}

function* matchPart(part: PatternPart, row: Row, used: ReadonlySet<GraphRel>, ctx: Ctx): Generator<[Row, ReadonlySet<GraphRel>]> {
  // Anchor: the first node already bound in the row, else the first node of the pattern.
  let anchor = part.nodes.findIndex((n) => n.variable !== undefined && row.has(n.variable));
  if (anchor < 0) anchor = 0;
  const anchorPat = part.nodes[anchor] as NodePattern;
  next: for (const start of candidateNodes(anchorPat, row, ctx)) {
    let r0 = bindNode(anchorPat, start, row, ctx);
    if (r0 === undefined) continue;
    // Neo4j filters the anchor with the WHERE conjuncts it can already decide before expanding from it (fuzz finding
    // F4: `ctrl.layer = $controllerLayer` rejects the anchor before a relationship predicate can raise an error). The
    // conjuncts stay in the WHERE; this only skips expansions it would reject.
    for (const c of ctx.early ?? []) {
      if (![...c.vars].every((v) => r0?.has(v) === true)) continue;
      const ok = tryPredicate(c.expr, r0, ctx);
      // Strict mode (diagnostics) raises the anchor conjuncts' errors and never prunes with them.
      if (evalDiagnostics.strict) {
        if (ok instanceof CypherRuntimeError) throw ok;
        continue;
      }
      if (ok === false) continue next;
      if (ok !== true) r0 = withPending(r0, ok);
    }
    // Expand to the right, then to the left, collecting the segments in pattern order.
    for (const [r1, u1, right] of expand(part, anchor, start, 1, r0, used, ctx)) {
      for (const [r2, u2, left] of expand(part, anchor, start, -1, r1, u1, ctx)) {
        if (part.pathVariable === undefined) {
          yield [r2, u2];
          continue;
        }
        const nodes: GraphNode[] = [];
        const rels: GraphRel[] = [];
        // left segments are from the anchor outward; reverse them into path order
        const leftRev = [...left].reverse();
        let first = start;
        if (leftRev.length > 0) first = (leftRev[0] as Segment).node;
        nodes.push(first);
        for (let k = 0; k < leftRev.length; k++) {
          const seg = leftRev[k] as Segment;
          const next = k + 1 < leftRev.length ? (leftRev[k + 1] as Segment).node : start;
          appendSegment(nodes, rels, [...seg.rels].reverse(), seg.node, next);
        }
        let cur = start;
        for (const seg of right) {
          appendSegment(nodes, rels, seg.rels, cur, seg.node);
          cur = seg.node;
        }
        if (row.has(part.pathVariable)) throw new CypherUnsupportedError(`path variable ${part.pathVariable} already bound`);
        yield [bind(r2, part.pathVariable, new CypherPath(nodes, rels)), u2];
      }
    }
  }
}

/** Appends a segment's relationships (in path order, from `from`) and the intermediate nodes they reach. */
function appendSegment(nodes: GraphNode[], rels: GraphRel[], segRels: readonly GraphRel[], from: GraphNode, to: GraphNode): void {
  let cur = from;
  for (const r of segRels) {
    rels.push(r);
    cur = r.start === cur ? r.end : r.start;
    nodes.push(cur);
  }
  if (segRels.length === 0 && from !== to) throw new Error('cypher-interp: internal error building a path');
}

/**
 * Expands the pattern from node index `at` one direction (`step` = 1 rightwards, -1 leftwards) until the end of the
 * pattern, yielding the row, the used relationships and the segments (anchor outward).
 */
function* expand(part: PatternPart, at: number, node: GraphNode, step: 1 | -1, row: Row, used: ReadonlySet<GraphRel>, ctx: Ctx): Generator<[Row, ReadonlySet<GraphRel>, readonly Segment[]]> {
  const relIndex = step === 1 ? at : at - 1;
  const relPat = part.rels[relIndex];
  if (relPat === undefined) {
    yield [row, used, []];
    return;
  }
  const nextPat = part.nodes[at + step] as NodePattern;
  // Leftwards the pattern direction is traversed backwards.
  const dir = relPat.direction === 'both' ? 'both' : step === 1 ? relPat.direction : relPat.direction === 'out' ? 'in' : 'out';
  for (const [rels, end, err] of traverse(relPat, dir, node, row, used, ctx)) {
    const r1 = bindNode(nextPat, end, row, ctx);
    if (r1 === undefined) {
      if (err !== undefined) suppress(err);
      continue;
    }
    let r2 = bindRel(relPat, rels, r1);
    if (r2 === undefined) continue;
    if (err !== undefined) r2 = withPending(r2, err);
    const u = new Set(used);
    for (const r of rels) u.add(r);
    for (const [r3, u3, segs] of expand(part, at + step, end, step, r2, u, ctx)) yield [r3, u3, [{ rels, node: end }, ...segs]];
  }
}

/** Relationships leaving `n` in direction `dir` (a self-loop once for an undirected pattern), in creation order. */
function* adjacent(n: GraphNode, dir: 'out' | 'in' | 'both', ctx: Ctx): Generator<[GraphRel, GraphNode]> {
  if (dir !== 'in') for (const r of ctx.graph.outgoing(n)) yield [r, r.end];
  if (dir !== 'out') for (const r of ctx.graph.incoming(n)) if (dir === 'in' || r.start !== r.end) yield [r, r.start];
}

function* traverse(p: RelPattern, dir: 'out' | 'in' | 'both', from: GraphNode, row: Row, used: ReadonlySet<GraphRel>, ctx: Ctx): Generator<[readonly GraphRel[], GraphNode, CypherRuntimeError?]> {
  if (p.range === undefined) {
    for (const [r, other] of adjacent(from, dir, ctx)) {
      if (used.has(r)) continue;
      const m = relMatches(p, r, row, ctx);
      if (m === false) continue;
      yield m === true ? [[r], other] : [[r], other, m];
    }
    return;
  }
  if (p.where !== undefined) throw new CypherUnsupportedError('WHERE inside a variable-length relationship pattern');
  const { min, max } = p.range;
  const push = ctx.pushed?.get(p);
  if (push?.nodes.some((q) => rejects(q, from, row, ctx)) === true) return;
  if (push?.reach === true) {
    // Breadth-first: every node reachable in >= min steps, once, nearest first.
    if (min === 0) yield [[], from];
    const seen = new Set<GraphNode>();
    let frontier = [from];
    while (frontier.length > 0) {
      const next: GraphNode[] = [];
      for (const n of frontier) {
        for (const [r, other] of adjacent(n, dir, ctx)) {
          if (seen.has(other) || used.has(r) || relMatches(p, r, row, ctx) !== true) continue;
          if (push.nodes.some((q) => rejects(q, other, row, ctx)) || push.rels.some((q) => rejects(q, r, row, ctx))) continue;
          seen.add(other);
          next.push(other);
          yield [[], other];
        }
      }
      frontier = next;
    }
    return;
  }
  // Depth-first, a path yielded when first reached (Neo4j's var-length expand order), relationships unique.
  const path: GraphRel[] = [];
  const onPath = new Set<GraphRel>();
  function* dfs(n: GraphNode): Generator<[readonly GraphRel[], GraphNode]> {
    if (path.length >= min) yield [[...path], n];
    if (max !== undefined && path.length >= max) return;
    for (const [r, other] of adjacent(n, dir, ctx)) {
      if (onPath.has(r) || used.has(r) || relMatches(p, r, row, ctx) !== true) continue;
      if (push !== undefined && (push.nodes.some((q) => rejects(q, other, row, ctx)) || push.rels.some((q) => rejects(q, r, row, ctx)))) continue;
      path.push(r);
      onPath.add(r);
      yield* dfs(other);
      path.pop();
      onPath.delete(r);
    }
  }
  yield* dfs(from);
}

/** Whether `r` matches the relationship pattern, or the data error its inline WHERE raised (see `PENDING`). */
function relMatches(p: RelPattern, r: GraphRel, row: Row, ctx: Ctx): boolean | CypherRuntimeError {
  if (p.types !== undefined && !labelMatches(p.types, (l) => r.type === l)) return false;
  if (p.properties !== undefined && !propertiesMatch(p.properties, r.properties, row, ctx)) return false;
  if (p.where !== undefined) {
    if (p.variable === undefined) throw new CypherUnsupportedError('WHERE in an unnamed relationship pattern');
    return tryPredicate(p.where, bind(row, p.variable, r), ctx);
  }
  return true;
}

function bindRel(p: RelPattern, rels: readonly GraphRel[], row: Row): Row | undefined {
  if (p.variable === undefined) return row;
  const value: Value = p.range === undefined ? (rels[0] as GraphRel) : rels;
  if (row.has(p.variable)) {
    const bound = row.get(p.variable) ?? null;
    return cypherEquals(bound, value) === true ? row : undefined;
  }
  return bind(row, p.variable, value);
}

function* candidateNodes(p: NodePattern, row: Row, ctx: Ctx): Generator<GraphNode> {
  if (p.variable !== undefined && row.has(p.variable)) {
    const v = row.get(p.variable) ?? null;
    if (v === null) return; // a null from OPTIONAL MATCH matches nothing
    if (!isNode(v)) throw new CypherRuntimeError(`Type mismatch: expected Node but was ${typeName(v)} (${p.variable})`);
    yield v;
    return;
  }
  const first = p.label !== undefined ? firstRequiredLabel(p.label) : undefined;
  yield* first !== undefined ? ctx.graph.nodesWithLabel(first) : ctx.graph.nodes;
}

/** A label every match must carry, when the expression requires one (an index for the scan). */
function firstRequiredLabel(l: LabelExpr): string | undefined {
  if (l.k === 'name') return l.name;
  if (l.k === 'and') for (const i of l.items) { const r = firstRequiredLabel(i); if (r !== undefined) return r; }
  return undefined;
}

function bindNode(p: NodePattern, n: GraphNode, row: Row, ctx: Ctx): Row | undefined {
  if (p.label !== undefined && !labelMatches(p.label, (l) => n.labels.has(l))) return undefined;
  if (p.properties !== undefined && !propertiesMatch(p.properties, n.properties, row, ctx)) return undefined;
  let out = row;
  if (p.variable !== undefined) {
    if (row.has(p.variable)) {
      const bound = row.get(p.variable) ?? null;
      if (bound !== n) return undefined;
    } else out = bind(row, p.variable, n);
  }
  if (p.where !== undefined) {
    const ok = tryPredicate(p.where, out, ctx);
    if (ok === false) return undefined;
    if (ok !== true) out = withPending(out, ok);
  }
  return out;
}

function labelMatches(l: LabelExpr, has: (label: string) => boolean): boolean {
  switch (l.k) {
    case 'name': return has(l.name);
    case 'any': return true;
    case 'not': return !labelMatches(l.e, has);
    case 'and': return l.items.every((i) => labelMatches(i, has));
    case 'or': return l.items.some((i) => labelMatches(i, has));
  }
}

function propertiesMatch(e: Expr, props: ReadonlyMap<string, Value>, row: Row, ctx: Ctx): boolean {
  const m = evaluate(e, row, ctx);
  if (!(m instanceof CypherMap)) throw new CypherRuntimeError('pattern properties must be a map');
  for (const [k, v] of m.entries) if (cypherEquals(props.get(k) ?? null, v) !== true) return false;
  return true;
}

// ── projection (WITH / RETURN) ──

function containsAggregate(e: Expr): boolean {
  switch (e.k) {
    case 'countStar': return true;
    case 'fn': return AGGREGATES.has(e.name.toLowerCase()) || e.args.some(containsAggregate);
    case 'prop': return containsAggregate(e.obj);
    case 'index': return containsAggregate(e.obj) || containsAggregate(e.idx);
    case 'slice': return containsAggregate(e.obj) || (e.from !== undefined && containsAggregate(e.from)) || (e.to !== undefined && containsAggregate(e.to));
    case 'list': return e.items.some(containsAggregate);
    case 'map': return e.entries.some(([, v]) => containsAggregate(v));
    case 'bin': return containsAggregate(e.l) || containsAggregate(e.r);
    case 'not': case 'neg': case 'isNull': case 'hasLabel': return containsAggregate(e.e);
    case 'case': return (e.subject !== undefined && containsAggregate(e.subject)) || e.whens.some(([a, b]) => containsAggregate(a) || containsAggregate(b)) || (e.otherwise !== undefined && containsAggregate(e.otherwise));
    default: return false; // literals, params, variables; aggregates inside comprehensions/subqueries are not allowed
  }
}

function collectAggregates(e: Expr, out: Expr[]): void {
  switch (e.k) {
    case 'countStar': out.push(e); return;
    case 'fn':
      if (AGGREGATES.has(e.name.toLowerCase())) {
        if (e.args.some(containsAggregate)) throw new CypherSyntaxError('Can\'t use aggregate functions inside of aggregate functions.');
        out.push(e);
        return;
      }
      for (const a of e.args) collectAggregates(a, out);
      return;
    case 'prop': collectAggregates(e.obj, out); return;
    case 'index': collectAggregates(e.obj, out); collectAggregates(e.idx, out); return;
    case 'slice': collectAggregates(e.obj, out); if (e.from) collectAggregates(e.from, out); if (e.to) collectAggregates(e.to, out); return;
    case 'list': for (const a of e.items) collectAggregates(a, out); return;
    case 'map': for (const [, v] of e.entries) collectAggregates(v, out); return;
    case 'bin': collectAggregates(e.l, out); collectAggregates(e.r, out); return;
    case 'not': case 'neg': case 'isNull': case 'hasLabel': collectAggregates(e.e, out); return;
    case 'case':
      if (e.subject) collectAggregates(e.subject, out);
      e.whens.forEach(([a, b]) => { collectAggregates(a, out); collectAggregates(b, out); });
      if (e.otherwise) collectAggregates(e.otherwise, out);
      return;
    default: return;
  }
}

interface AggState {
  update(v: Value): void;
  result(): Value;
}

function aggState(e: Expr): AggState {
  if (e.k === 'countStar') {
    let n = 0n;
    return { update: () => { n += 1n; }, result: () => n };
  }
  if (e.k !== 'fn') throw new Error('cypher-interp: not an aggregate');
  const name = e.name.toLowerCase();
  const seen = e.distinct ? new Set<string>() : undefined;
  const firstTime = (v: Value): boolean => {
    if (seen === undefined) return true;
    const k = equivalenceKey(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  switch (name) {
    case 'count': {
      let n = 0n;
      return { update: (v) => { if (v !== null && firstTime(v)) n += 1n; }, result: () => n };
    }
    case 'collect': {
      const out: Value[] = [];
      return { update: (v) => { if (v !== null && firstTime(v)) out.push(v); }, result: () => out };
    }
    case 'sum': {
      let i = 0n;
      let f: number | undefined;
      return {
        update: (v) => {
          if (v === null || !firstTime(v)) return;
          if (typeof v === 'bigint') { if (f === undefined) i = checkedInt(i + v); else f += Number(v); }
          else if (typeof v === 'number') { f = (f ?? Number(i)) + v; }
          else throw new CypherRuntimeError(`sum() of a ${typeName(v)}`);
        },
        result: () => f ?? i,
      };
    }
    case 'avg': {
      // Neo4j 5.26 AvgFunction: an incremental mean over doubles (not sum / count); 200/200 random float lists
      // agree with 5.26.24 bit for bit, the naive sum / count agrees on 93.
      let n = 0;
      let mean = 0;
      return {
        update: (v) => {
          if (v === null || !firstTime(v)) return;
          if (!isNumber(v)) throw new CypherRuntimeError(`avg() of a ${typeName(v)}`);
          n += 1;
          mean += (Number(v) - mean) / n;
        },
        result: () => (n === 0 ? null : mean),
      };
    }
    case 'min': case 'max': {
      let best: Value = null;
      const sign = name === 'min' ? -1 : 1;
      return {
        update: (v) => { if (v !== null && (best === null || Math.sign(cypherOrder(v, best)) === sign)) best = v; },
        result: () => best,
      };
    }
    default: throw new CypherUnsupportedError(`aggregate ${e.name}`);
  }
}

function project(p: Projection, rows: Iterable<Row>, ctx: Ctx): Iterable<Row> {
  const hasAgg = p.items.some((i) => containsAggregate(i.expr));
  const needsEager = hasAgg || p.distinct || p.orderBy.length > 0;
  if (!needsEager && p.skip === undefined && p.limit === undefined) return streamProject(p, rows, ctx);
  return eagerProject(p, rows, ctx, hasAgg);
}

function projectRow(p: Projection, r: Row, ctx: Ctx): Map<string, Value> {
  const out = p.star ? new Map(r) : new Map<string, Value>();
  for (const it of p.items) out.set(it.alias, evaluate(it.expr, r, ctx));
  return out;
}

function* streamProject(p: Projection, rows: Iterable<Row>, ctx: Ctx): Generator<Row> {
  for (const r of rows) yield projectRow(p, r, ctx);
}

interface Projected {
  readonly out: Map<string, Value>;
  /** The scope ORDER BY reads: projected columns first, then (without aggregation or DISTINCT) the input row. */
  readonly scope: Row;
}

function eagerProject(p: Projection, rows: Iterable<Row>, ctx: Ctx, hasAgg: boolean): Row[] {
  let projected: Projected[] = [];
  if (hasAgg) {
    const aggNodes: Expr[] = [];
    for (const it of p.items) collectAggregates(it.expr, aggNodes);
    const keyItems = p.items.filter((i) => !containsAggregate(i.expr));
    const groups = new Map<string, { row: Row; keys: Value[]; states: AggState[] }>();
    for (const r of rows) {
      const keys = keyItems.map((i) => evaluate(i.expr, r, ctx));
      const gk = keys.map(equivalenceKey).join('\u0000');
      let g = groups.get(gk);
      if (g === undefined) groups.set(gk, (g = { row: r, keys, states: aggNodes.map(aggState) }));
      aggNodes.forEach((a, idx) => {
        const st = g.states[idx] as AggState;
        if (a.k === 'countStar') st.update(null);
        else if (a.k === 'fn') {
          if (a.args.length !== 1 && !['percentilecont', 'percentiledisc'].includes(a.name.toLowerCase())) throw new CypherRuntimeError(`${a.name}() takes one argument`);
          st.update(evaluate(a.args[0] as Expr, r, ctx));
        }
      });
    }
    if (groups.size === 0 && keyItems.length === 0) groups.set('', { row: new Map(), keys: [], states: aggNodes.map(aggState) });
    for (const g of groups.values()) {
      const aggregates = new Map<Expr, Value>(aggNodes.map((a, idx) => [a, (g.states[idx] as AggState).result()]));
      const gctx: Ctx = { ...ctx, aggregates };
      const out = new Map<string, Value>();
      let ki = 0;
      for (const it of p.items) out.set(it.alias, containsAggregate(it.expr) ? evaluate(it.expr, g.row, gctx) : (g.keys[ki++] ?? null));
      projected.push({ out, scope: out });
    }
  } else {
    for (const r of rows) {
      const out = projectRow(p, r, ctx);
      projected.push({ out, scope: p.distinct ? out : mergeScope(out, r) });
    }
  }
  if (p.distinct) {
    const seen = new Set<string>();
    projected = projected.filter((x) => {
      const k = [...x.out.values()].map(equivalenceKey).join('\u0000');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  if (p.orderBy.length > 0) {
    const keyed = projected.map((x) => ({ x, keys: p.orderBy.map((o) => evaluate(o.expr, x.scope, ctx)) }));
    keyed.sort((a, b) => {
      for (let i = 0; i < p.orderBy.length; i++) {
        const c = cypherOrder(a.keys[i] as Value, b.keys[i] as Value);
        if (c !== 0) return (p.orderBy[i] as { descending: boolean }).descending ? -c : c;
      }
      return 0;
    });
    projected = keyed.map((k) => k.x);
  }
  const empty: Row = new Map();
  const skip = p.skip === undefined ? 0 : nonNegative(evaluate(p.skip, empty, ctx), 'SKIP');
  const limit = p.limit === undefined ? undefined : nonNegative(evaluate(p.limit, empty, ctx), 'LIMIT');
  const sliced = projected.slice(skip, limit === undefined ? undefined : skip + limit);
  return sliced.map((x) => x.out);
}

function mergeScope(out: Map<string, Value>, r: Row): Row {
  const m = new Map(r);
  for (const [k, v] of out) m.set(k, v);
  return m;
}

function nonNegative(v: Value, what: string): number {
  if (typeof v !== 'bigint' || v < 0n) throw new CypherRuntimeError(`Invalid input. '${v === null ? 'null' : scalarToStringSafe(v)}' is not a valid value. Must be a non-negative integer. (${what})`, 'Neo.ClientError.Statement.ArgumentError');
  return Number(v);
}

function scalarToStringSafe(v: Value): string {
  try { return scalarToString(v); } catch { return typeName(v); }
}

// ── expressions ──

/**
 * A value in a boolean position (WHERE, NOT / AND / OR / XOR, CASE WHEN, a quantifier's or comprehension's WHERE), as
 * Neo4j 5.26.24 coerces it (fuzz finding F5): a list is true when non-empty (`NOT ['A']` is false, `WHERE []` drops
 * the row); any other non-boolean is a type error at run time, except a string, integer or map parameter, which Neo4j
 * already rejects when planning (`Type mismatch for parameter`).
 */
function predicate(e: Expr, row: Row, ctx: Ctx, what: string): boolean | null {
  const v = evaluate(e, row, ctx);
  if (v === null || typeof v === 'boolean') return v;
  if (isList(v)) return v.length > 0;
  if (e.k === 'param' && (typeof v === 'string' || typeof v === 'bigint' || v instanceof CypherMap)) {
    throw new CypherSyntaxError(`Type mismatch for parameter '${e.name}': expected Boolean but was ${typeName(v)}`);
  }
  throw new CypherRuntimeError(`Don't know how to treat that as a predicate: ${typeName(v)} (${what})`);
}

export function evaluate(e: Expr, row: Row, ctx: Ctx): Value {
  switch (e.k) {
    case 'lit': return e.v;
    case 'param': {
      if (!ctx.params.has(e.name)) throw new CypherRuntimeError(`Expected parameter(s): ${e.name}`, 'Neo.ClientError.Statement.ParameterMissing');
      return ctx.params.get(e.name) ?? null;
    }
    case 'var': {
      if (!row.has(e.name)) throw new CypherSyntaxError(`Variable \`${e.name}\` not defined`);
      return row.get(e.name) ?? null;
    }
    case 'prop': return property(evaluate(e.obj, row, ctx), e.key);
    case 'index': return indexValue(evaluate(e.obj, row, ctx), evaluate(e.idx, row, ctx));
    case 'slice': return sliceValue(e, row, ctx);
    case 'list': return e.items.map((i) => evaluate(i, row, ctx));
    case 'map': return new CypherMap(new Map(e.entries.map(([k, v]) => [k, evaluate(v, row, ctx)])));
    case 'not': {
      const v = predicate(e.e, row, ctx, 'NOT');
      return v === null ? null : !v;
    }
    case 'neg': {
      const v = evaluate(e.e, row, ctx);
      if (v === null) return null;
      if (typeof v === 'bigint') return checkedInt(-v);
      if (typeof v === 'number') return -v;
      throw new CypherRuntimeError(`Cannot negate ${typeName(v)}`);
    }
    case 'isNull': {
      const isNull = evaluate(e.e, row, ctx) === null;
      return e.negated ? !isNull : isNull;
    }
    case 'hasLabel': {
      const v = evaluate(e.e, row, ctx);
      if (v === null) return null;
      if (isNode(v)) return labelMatches(e.label, (l) => v.labels.has(l));
      if (isRel(v)) return labelMatches(e.label, (l) => v.type === l);
      throw new CypherRuntimeError(`Type mismatch: expected Node but was ${typeName(v)}`);
    }
    case 'case': {
      if (e.subject === undefined) {
        for (const [w, t] of e.whens) if (predicate(w, row, ctx, 'CASE WHEN') === true) return evaluate(t, row, ctx);
      } else {
        const s = evaluate(e.subject, row, ctx);
        for (const [w, t] of e.whens) if (cypherEquals(s, evaluate(w, row, ctx)) === true) return evaluate(t, row, ctx);
      }
      return e.otherwise === undefined ? null : evaluate(e.otherwise, row, ctx);
    }
    case 'countStar':
    case 'fn': {
      const agg = ctx.aggregates?.get(e);
      if (agg !== undefined) return agg;
      if (e.k === 'countStar' || AGGREGATES.has(e.name.toLowerCase())) {
        if (ctx.aggregates?.has(e) === true) return null;
        throw new CypherUnsupportedError('aggregate function outside a WITH/RETURN projection');
      }
      const fn = lookupFunction(e.name);
      if (fn === undefined) throw new CypherUnsupportedError(`function ${e.name}()`);
      if (e.distinct) throw new CypherUnsupportedError(`DISTINCT in ${e.name}()`);
      return fn(e.args.map((a) => evaluate(a, row, ctx)));
    }
    case 'exists': {
      const existential = e.query.clauses.every((c) => c.k === 'match' && !c.optional);
      let found = false;
      for (const _ of runClauses(e.query.clauses, [row], { graph: ctx.graph, params: ctx.params, existential })) {
        found = true;
        // Strict mode (diagnostics) visits every row, as an EXISTS whose plan finds the qualifying row last would.
        if (!evalDiagnostics.strict) break;
      }
      return found;
    }
    case 'listComp': {
      const l0 = evaluate(e.list, row, ctx);
      if (l0 === null) return null;
      const l = traversable(l0);
      const out: Value[] = [];
      for (const item of l) {
        const r = bind(row, e.v, item);
        if (e.where !== undefined && predicate(e.where, r, ctx, 'WHERE') !== true) continue;
        out.push(e.map === undefined ? item : evaluate(e.map, r, ctx));
      }
      return out;
    }
    case 'quant': return quantifier(e, row, ctx);
    case 'reduce': {
      const l0 = evaluate(e.list, row, ctx);
      if (l0 === null) return null;
      const l = traversable(l0);
      let acc = evaluate(e.init, row, ctx);
      for (const item of l) acc = evaluate(e.expr, bind(bind(row, e.acc, acc), e.v, item), ctx);
      return acc;
    }
    case 'bin': return binary(e.op, e.l, e.r, row, ctx);
  }
}

/**
 * The list an iterating expression walks: Neo4j 5.26.24 treats any other non-null value as a one-element list in the
 * quantifiers, list comprehensions, `reduce`, `IN`, `tail` and slicing (`ANY(d IN 0.5 WHERE d = 0.5)` is true,
 * `1 IN 3` is false, `3[0..1]` is `[3]`; fuzz finding F3). `size`, `head`, `last`, `[i]` and the APOC functions
 * still reject it.
 */
function traversable(v: Exclude<Value, null>): readonly Value[] {
  return isList(v) ? v : [v];
}

function quantifier(e: Extract<Expr, { k: 'quant' }>, row: Row, ctx: Ctx): Value {
  const v0 = evaluate(e.list, row, ctx);
  if (v0 === null) return null;
  const l = traversable(v0);
  let trues = 0;
  let nulls = 0;
  let falses = 0;
  for (const item of l) {
    const v = predicate(e.where as Expr, bind(row, e.v, item), ctx, e.q);
    if (v === true) trues++; else if (v === null) nulls++; else falses++;
    if (e.q === 'any' && trues > 0) return true;
    if (e.q === 'none' && trues > 0) return false;
    if (e.q === 'all' && falses > 0) return false;
    if (e.q === 'single' && trues > 1) return false;
  }
  switch (e.q) {
    case 'any': return nulls > 0 ? null : false;
    case 'none': return nulls > 0 ? null : true;
    case 'all': return nulls > 0 ? null : true;
    case 'single': return nulls > 0 ? null : trues === 1;
  }
}

function property(o: Value, key: string): Value {
  if (o === null) return null;
  if (isNode(o) || isRel(o)) return o.properties.get(key) ?? null;
  if (o instanceof CypherMap) return o.entries.get(key) ?? null;
  throw new CypherRuntimeError(`Type mismatch: expected a map but was ${typeName(o)} (property ${key})`);
}

function indexValue(o: Value, i: Value): Value {
  if (o === null || i === null) return null;
  if (isList(o)) {
    if (typeof i !== 'bigint') throw new CypherRuntimeError(`List index must be an Integer, got ${typeName(i)}`);
    const n = BigInt(o.length);
    const idx = i < 0n ? n + i : i;
    if (idx < 0n || idx >= n) return null;
    return o[Number(idx)] ?? null;
  }
  if (typeof i === 'string') return property(o, i);
  throw new CypherRuntimeError(`Cannot index ${typeName(o)} with ${typeName(i)}`);
}

function sliceValue(e: Extract<Expr, { k: 'slice' }>, row: Row, ctx: Ctx): Value {
  const o0 = evaluate(e.obj, row, ctx);
  const from = e.from === undefined ? undefined : evaluate(e.from, row, ctx);
  const to = e.to === undefined ? undefined : evaluate(e.to, row, ctx);
  if (o0 === null || from === null || to === null) return null;
  const o = traversable(o0);
  const n = o.length;
  const norm = (v: Value | undefined, dflt: number): number => {
    if (v === undefined) return dflt;
    if (typeof v !== 'bigint') throw new CypherRuntimeError(`List slice bound must be an Integer, got ${typeName(v)}`);
    const x = Number(v);
    const y = x < 0 ? n + x : x;
    return Math.min(Math.max(y, 0), n);
  };
  const a = norm(from, 0);
  const b = norm(to, n);
  return a >= b ? [] : o.slice(a, b);
}

function and(a: boolean | null, b: boolean | null): boolean | null {
  if (a === false || b === false) return false;
  if (a === null || b === null) return null;
  return true;
}

/** A boolean operand, or the data error evaluating it raised (held back until the result is known to need it). */
function tryBool(e: Expr, what: string, row: Row, ctx: Ctx): boolean | null | CypherRuntimeError {
  try {
    return predicate(e, row, ctx, what);
  } catch (err) {
    if (err instanceof CypherRuntimeError) return err;
    throw err;
  }
}

/** A predicate's outcome for filtering (`true` keeps the row), or the data error it raised. */
function tryPredicate(e: Expr, row: Row, ctx: Ctx): boolean | CypherRuntimeError {
  try {
    return predicate(e, row, ctx, 'WHERE') === true;
  } catch (err) {
    if (err instanceof CypherRuntimeError) return err;
    throw err;
  }
}

function binary(op: string, le: Expr, re: Expr, row: Row, ctx: Ctx): Value {
  if (op === 'AND' || op === 'OR' || op === 'XOR') {
    // Neo4j raises an operand's data error only when the result depends on that operand: `false AND <error>` and
    // `<error> AND false` are false, `true OR <error>` is true, in either order (5.26.24, live; fuzz finding F1).
    const a = tryBool(le, op, row, ctx);
    const b = tryBool(re, op, row, ctx);
    const decided = op === 'AND' ? a === false || b === false : op === 'OR' ? a === true || b === true : false;
    if (decided) {
      for (const x of [a, b]) if (x instanceof CypherRuntimeError) suppress(x);
      return op === 'AND' ? false : true;
    }
    if (a instanceof CypherRuntimeError) throw a;
    if (b instanceof CypherRuntimeError) throw b;
    if (op === 'AND') return and(a, b);
    if (a === null || b === null) return null;
    return op === 'OR' ? a || b : a !== b;
  }
  const l = evaluate(le, row, ctx);
  const r = evaluate(re, row, ctx);
  switch (op) {
    case '=': return cypherEquals(l, r);
    case '<>': { const eq = cypherEquals(l, r); return eq === null ? null : !eq; }
    case '<': { const c = cypherCompare(l, r); return c === null ? null : c < 0; }
    case '>': { const c = cypherCompare(l, r); return c === null ? null : c > 0; }
    case '<=': { const c = cypherCompare(l, r); return c === null ? null : c <= 0; }
    case '>=': { const c = cypherCompare(l, r); return c === null ? null : c >= 0; }
    case 'STARTS WITH': return typeof l === 'string' && typeof r === 'string' ? l.startsWith(r) : null;
    case 'ENDS WITH': return typeof l === 'string' && typeof r === 'string' ? l.endsWith(r) : null;
    case 'CONTAINS': return typeof l === 'string' && typeof r === 'string' ? l.includes(r) : null;
    case '=~': return typeof l === 'string' && typeof r === 'string' ? javaRegex(r).test(l) : null;
    case 'IN': {
      if (r === null) return null;
      let sawNull = false;
      for (const x of traversable(r)) {
        const eq = cypherEquals(l, x);
        if (eq === true) return true;
        if (eq === null) sawNull = true;
      }
      return sawNull ? null : false;
    }
    default: return arithmetic(op, l, r);
  }
}

function arithmetic(op: string, l: Value, r: Value): Value {
  if (l === null || r === null) return null;
  if (op === '+') {
    if (isList(l)) return isList(r) ? [...l, ...r] : [...l, r];
    if (isList(r)) return [l, ...r];
    if (typeof l === 'string' || typeof r === 'string') {
      if ((typeof l === 'string' || isNumber(l)) && (typeof r === 'string' || isNumber(r))) return scalarToString(l) + scalarToString(r);
      throw new CypherRuntimeError(`Cannot add ${typeName(l)} and ${typeName(r)}`);
    }
  }
  if (!isNumber(l) || !isNumber(r)) throw new CypherRuntimeError(`Cannot apply ${op} to ${typeName(l)} and ${typeName(r)}`);
  if (op === '^') return Math.pow(Number(l), Number(r));
  if (typeof l === 'bigint' && typeof r === 'bigint') {
    switch (op) {
      case '+': return checkedInt(l + r);
      case '-': return checkedInt(l - r);
      case '*': return checkedInt(l * r);
      case '/': if (r === 0n) throw new CypherRuntimeError('/ by zero', 'Neo.ClientError.Statement.ArithmeticError'); return checkedInt(l / r);
      case '%': if (r === 0n) throw new CypherRuntimeError('/ by zero', 'Neo.ClientError.Statement.ArithmeticError'); return l % r;
    }
  }
  const a = Number(l);
  const b = Number(r);
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
  }
  throw new CypherUnsupportedError(`operator ${op}`);
}
