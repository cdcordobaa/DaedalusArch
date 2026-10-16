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

interface Ctx {
  readonly graph: MemoryGraph;
  readonly params: ReadonlyMap<string, Value>;
  /** Aggregate results of the group being projected, by AST node. */
  readonly aggregates?: ReadonlyMap<Expr, Value>;
  /** The query's deadline (NFR-07), shared by every nested scope of one query. */
  readonly budget: Budget;
}

/**
 * NFR-07 for the interpreter: evaluation is synchronous, so the timeout is cooperative. `tick` runs on every node scan
 * step, relationship expansion step and input row; every 1024 ticks it reads the clock and, past the deadline, throws
 * Neo4j's client-configured timeout error. A query cannot outrun its deadline by more than 1024 steps plus one sort.
 */
interface Budget {
  readonly deadline: number;
  readonly timeoutMs: number;
  n: number;
}

export const QUERY_TIMEOUT_CODE = 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration';

function tick(ctx: Ctx): void {
  const b = ctx.budget;
  if ((++b.n & 1023) !== 0 || !Number.isFinite(b.deadline)) return;
  if (performance.now() > b.deadline) {
    throw new CypherRuntimeError(`The transaction has been terminated: it ran longer than its configured timeout of ${String(b.timeoutMs)} ms`, QUERY_TIMEOUT_CODE);
  }
}

export interface ExecuteOptions {
  /** Abort with `QUERY_TIMEOUT_CODE` once evaluation has run this long (absent or <= 0: no limit). */
  readonly timeoutMs?: number;
  /** `performance.now()` at which the clock started (default: now); lets the caller count parsing in. */
  readonly startedAt?: number;
}

export interface QueryOutput {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Value[])[];
}

export function executeQuery(query: Query, graph: MemoryGraph, params: ReadonlyMap<string, Value>, options: ExecuteOptions = {}): QueryOutput {
  const timeoutMs = options.timeoutMs ?? 0;
  const deadline = timeoutMs > 0 ? (options.startedAt ?? performance.now()) + timeoutMs : Infinity;
  const ctx: Ctx = { graph, params, budget: { deadline, timeoutMs, n: 0 } };
  const last = query.clauses[query.clauses.length - 1];
  if (last?.k !== 'return') throw new CypherSyntaxError('Query cannot conclude with ' + (last?.k.toUpperCase() ?? 'nothing') + ' (must be a RETURN clause)');
  const rows: (readonly Value[])[] = [];
  let columns: string[] = [];
  for (const row of runClauses(query.clauses, [new Map()], ctx)) {
    tick(ctx);
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
    case 'call': return callSubquery(clause, rows, ctx);
  }
}

/**
 * `CALL { ... }` (unit subquery, returning). Per incoming row: each part runs on that row when it starts with `WITH`
 * (the importing WITH; its projection decides what is visible) and on an empty row otherwise; parts' rows are
 * concatenated in part order, `UNION` drops repeated rows (equivalence, first seen kept), `UNION ALL` keeps them. The
 * returned columns join the outer row; a column that rebinds an outer variable is an error, as in Neo4j. When no part
 * imports (uncorrelated), the parts' rows are computed once and joined to every incoming row.
 */
function* callSubquery(clause: Extract<Clause, { k: 'call' }>, rows: Iterable<Row>, ctx: Ctx): Generator<Row> {
  const { columns } = clause;
  const correlated = clause.parts.some((p) => p.clauses[0]?.k === 'with');
  const innerRows = (outer: Row): Row[] => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const part of clause.parts) {
      const input: Row = part.clauses[0]?.k === 'with' ? outer : new Map();
      for (const r of runClauses(part.clauses, [input], ctx)) {
        tick(ctx);
        if (!clause.unionAll && clause.parts.length > 1) {
          const key = columns.map((c) => equivalenceKey(r.get(c) ?? null)).join('\u0000');
          if (seen.has(key)) continue;
          seen.add(key);
        }
        out.push(new Map<string, Value>(columns.map((c) => [c, r.get(c) ?? null])));
      }
    }
    return out;
  };
  let cached: Row[] | undefined;
  for (const outer of rows) {
    for (const c of columns) {
      if (outer.has(c)) throw new CypherSyntaxError(`Variable \`${c}\` already declared in outer scope`);
    }
    const inner = correlated ? innerRows(outer) : (cached ??= innerRows(outer));
    for (const r of inner) {
      const m = new Map(outer);
      for (const [k, v] of r) m.set(k, v);
      yield m;
    }
  }
}

function* filter(rows: Iterable<Row>, where: Expr, ctx: Ctx): Generator<Row> {
  for (const r of rows) {
    tick(ctx);
    if (evaluate(where, r, ctx) === true) yield r;
  }
}

function* unwind(expr: Expr, alias: string, rows: Iterable<Row>, ctx: Ctx): Generator<Row> {
  for (const r of rows) {
    const v = evaluate(expr, r, ctx);
    if (v === null) continue;
    const items = isList(v) ? v : [v];
    for (const item of items) {
      tick(ctx);
      yield bind(r, alias, item);
    }
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

function* matchClause(clause: Extract<Clause, { k: 'match' }>, rows: Iterable<Row>, ctx: Ctx): Generator<Row> {
  for (const r of rows) {
    let any = false;
    for (const m of matchParts(clause.patterns, 0, r, new Set(), ctx)) {
      if (clause.where !== undefined && evaluate(clause.where, m, ctx) !== true) continue;
      any = true;
      yield m;
    }
    if (!any && clause.optional) {
      const out = new Map(r);
      for (const v of patternVariables(clause.patterns)) if (!out.has(v)) out.set(v, null);
      yield out;
    }
  }
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
  for (const start of candidateNodes(anchorPat, row, ctx)) {
    const r0 = bindNode(anchorPat, start, row, ctx);
    if (r0 === undefined) continue;
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
  for (const [rels, end] of traverse(relPat, dir, node, row, used, ctx)) {
    const r1 = bindNode(nextPat, end, row, ctx);
    if (r1 === undefined) continue;
    const r2 = bindRel(relPat, rels, r1);
    if (r2 === undefined) continue;
    const u = new Set(used);
    for (const r of rels) u.add(r);
    for (const [r3, u3, segs] of expand(part, at + step, end, step, r2, u, ctx)) yield [r3, u3, [{ rels, node: end }, ...segs]];
  }
}

/** Relationships leaving `n` in direction `dir` (a self-loop once for an undirected pattern), in creation order. */
function* adjacent(n: GraphNode, dir: 'out' | 'in' | 'both', ctx: Ctx): Generator<[GraphRel, GraphNode]> {
  if (dir !== 'in') {
    for (const r of ctx.graph.outgoing(n)) {
      tick(ctx);
      yield [r, r.end];
    }
  }
  if (dir !== 'out') {
    for (const r of ctx.graph.incoming(n)) {
      tick(ctx);
      if (dir === 'in' || r.start !== r.end) yield [r, r.start];
    }
  }
}

function* traverse(p: RelPattern, dir: 'out' | 'in' | 'both', from: GraphNode, row: Row, used: ReadonlySet<GraphRel>, ctx: Ctx): Generator<[readonly GraphRel[], GraphNode]> {
  if (p.range === undefined) {
    for (const [r, other] of adjacent(from, dir, ctx)) {
      if (used.has(r) || !relMatches(p, r, row, ctx)) continue;
      yield [[r], other];
    }
    return;
  }
  if (p.where !== undefined) throw new CypherUnsupportedError('WHERE inside a variable-length relationship pattern');
  const { min, max } = p.range;
  // Depth-first, a path yielded when first reached (Neo4j's var-length expand order), relationships unique.
  const path: GraphRel[] = [];
  const onPath = new Set<GraphRel>();
  function* dfs(n: GraphNode): Generator<[readonly GraphRel[], GraphNode]> {
    if (path.length >= min) yield [[...path], n];
    if (max !== undefined && path.length >= max) return;
    for (const [r, other] of adjacent(n, dir, ctx)) {
      if (onPath.has(r) || used.has(r) || !relMatches(p, r, row, ctx)) continue;
      path.push(r);
      onPath.add(r);
      yield* dfs(other);
      path.pop();
      onPath.delete(r);
    }
  }
  yield* dfs(from);
}

function relMatches(p: RelPattern, r: GraphRel, row: Row, ctx: Ctx): boolean {
  if (p.types !== undefined && !labelMatches(p.types, (l) => r.type === l)) return false;
  if (p.properties !== undefined && !propertiesMatch(p.properties, r.properties, row, ctx)) return false;
  if (p.where !== undefined) {
    if (p.variable === undefined) throw new CypherUnsupportedError('WHERE in an unnamed relationship pattern');
    if (evaluate(p.where, bind(row, p.variable, r), ctx) !== true) return false;
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
  for (const n of first !== undefined ? ctx.graph.nodesWithLabel(first) : ctx.graph.nodes) {
    tick(ctx);
    yield n;
  }
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
  if (p.where !== undefined && evaluate(p.where, out, ctx) !== true) return undefined;
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
      tick(ctx);
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
      tick(ctx);
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

function bool(v: Value, what: string): boolean | null {
  if (v === null || typeof v === 'boolean') return v;
  throw new CypherRuntimeError(`Type mismatch: expected Boolean but was ${typeName(v)} (${what})`);
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
      const v = bool(evaluate(e.e, row, ctx), 'NOT');
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
        for (const [w, t] of e.whens) if (evaluate(w, row, ctx) === true) return evaluate(t, row, ctx);
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
      for (const _ of runClauses(e.query.clauses, [row], ctx)) return true;
      return false;
    }
    case 'listComp': {
      const l = evaluate(e.list, row, ctx);
      if (l === null) return null;
      if (!isList(l)) throw new CypherRuntimeError(`Type mismatch: expected List but was ${typeName(l)}`);
      const out: Value[] = [];
      for (const item of l) {
        const r = bind(row, e.v, item);
        if (e.where !== undefined && evaluate(e.where, r, ctx) !== true) continue;
        out.push(e.map === undefined ? item : evaluate(e.map, r, ctx));
      }
      return out;
    }
    case 'quant': return quantifier(e, row, ctx);
    case 'reduce': {
      const l = evaluate(e.list, row, ctx);
      if (l === null) return null;
      if (!isList(l)) throw new CypherRuntimeError(`Type mismatch: expected List but was ${typeName(l)}`);
      let acc = evaluate(e.init, row, ctx);
      for (const item of l) acc = evaluate(e.expr, bind(bind(row, e.acc, acc), e.v, item), ctx);
      return acc;
    }
    case 'bin': return binary(e.op, e.l, e.r, row, ctx);
  }
}

function quantifier(e: Extract<Expr, { k: 'quant' }>, row: Row, ctx: Ctx): Value {
  const l = evaluate(e.list, row, ctx);
  if (l === null) return null;
  if (!isList(l)) throw new CypherRuntimeError(`Type mismatch: expected List but was ${typeName(l)}`);
  let trues = 0;
  let nulls = 0;
  let falses = 0;
  for (const item of l) {
    const v = bool(evaluate(e.where as Expr, bind(row, e.v, item), ctx), e.q);
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
  const o = evaluate(e.obj, row, ctx);
  const from = e.from === undefined ? undefined : evaluate(e.from, row, ctx);
  const to = e.to === undefined ? undefined : evaluate(e.to, row, ctx);
  if (o === null || from === null || to === null) return null;
  if (!isList(o)) throw new CypherRuntimeError(`Cannot slice ${typeName(o)}`);
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

function binary(op: string, le: Expr, re: Expr, row: Row, ctx: Ctx): Value {
  if (op === 'AND' || op === 'OR' || op === 'XOR') {
    const a = bool(evaluate(le, row, ctx), op);
    const b = bool(evaluate(re, row, ctx), op);
    if (op === 'AND') return and(a, b);
    if (op === 'OR') {
      if (a === true || b === true) return true;
      if (a === null || b === null) return null;
      return false;
    }
    if (a === null || b === null) return null;
    return a !== b;
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
      if (!isList(r)) throw new CypherRuntimeError(`Type mismatch: expected List but was ${typeName(r)} (IN)`);
      let sawNull = false;
      for (const x of r) {
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
