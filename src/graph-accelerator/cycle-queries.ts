/**
 * In-memory answers to the two bounded cycle queries (Docs/v1.3/scale.md §3): the FF-S02 `no-cyclic-deps` template
 * and the universal `cyclicDependencyCount` metric. Both are variable-length path queries (`*2..MAX_CYCLE_LENGTH`) that
 * Neo4j answers by enumerating every bounded path from every File; on large projects they hit the 30 s query timeout.
 *
 * The template text is not edited. The accelerated texts are recognised byte for byte: the compiled FF-S02 text in
 * each of its four forms (with or without the exclude predicate, with or without the v1.3 literal edge view), built
 * here with the compiler's own functions, and the two metric texts. Each answer returns the same rows, in the same
 * order, with the same value types as the Neo4j driver does (`line` a JS number or null, `cnt` a driver Integer).
 *
 * Semantics reproduced (FF-S02):
 *   MATCH p = (f:File)-[:IMPORTS|RE_EXPORTS*2..10]->(f)  (literal view: no relationship with viaReExport = true)
 *   WHERE every node's filePath >= f.filePath AND nodes(p)[1..] are distinct (a simple cycle)
 *     [AND no node's filePath =~ any $excludePatterns]
 *   one row per distinct node sequence, line = min(first relationship's line), ORDER BY cycle, LIMIT 101.
 * The enumeration runs per strongly connected component, prunes a branch when the remaining distance back to `f`
 * exceeds the length bound, and visits neighbours in ascending filePath order with the closing edge first, so the
 * cycles come out already in `ORDER BY cycle` order and the walk stops at the LIMIT.
 *
 * Semantics reproduced (metric): count(f:File) such that a closed relationship-distinct walk of 2..10 relationships
 * runs from f back to f. Such a walk exists exactly when f lies on a simple cycle of length 2..10 (the shortest one
 * is found by breadth-first search inside f's component) or f carries two or more self-loop relationships.
 *
 * Every answer has guards; outside them it returns `undefined` and the caller runs the query on Neo4j:
 * non-File nodes with outgoing IMPORTS/RE_EXPORTS, a filePath that is not printable ASCII (string order and regex
 * `.` then agree between Java and JavaScript), duplicate filePaths among cycle-capable nodes, a `line` that is not a
 * number, a `viaReExport` that is not a boolean, an exclude pattern outside the `globToRegex` grammar, or a walk that
 * exceeds the step budget.
 */
import neo4j from 'neo4j-driver';
import { CYCLE_ROW_CAP, CYPHER_TEMPLATES, MAX_CYCLE_LENGTH } from '../fitness-compiler/cypher-templates.js';
import { replaceExcludeMarkers } from '../fitness-compiler/exclude-injector.js';
import { applyV13Rewrites } from '../fitness-compiler/v13-rewrites.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../scoring-engine/universal-metrics.js';
import type { GraphMirror, MirrorRel } from './graph-mirror.js';

export type EdgeFilter = 'all' | 'literal';

export interface AcceleratedQuery {
  readonly name: 'no-cyclic-deps' | 'cyclicDependencyCount';
  readonly filter: EdgeFilter;
  readonly excludes: boolean;
}

type Row = Record<string, unknown>;

/** DFS steps (node expansions) one FF-S02 answer may take before it hands the query back to Neo4j. */
export const CYCLE_STEP_BUDGET = 20_000_000;

const CYCLE_TEMPLATE = 'no-cyclic-deps';

function recognisedTexts(): ReadonlyMap<string, AcceleratedQuery> {
  const texts = new Map<string, AcceleratedQuery>();
  const template = CYPHER_TEMPLATES.get(CYCLE_TEMPLATE)?.template;
  if (template !== undefined) {
    for (const excludes of [false, true]) {
      const base = replaceExcludeMarkers(template, excludes);
      const plain = applyV13Rewrites(CYCLE_TEMPLATE, base, { edgeViews: false, roleTokens: false });
      const literal = applyV13Rewrites(CYCLE_TEMPLATE, base, { edgeViews: true, roleTokens: false });
      // Only texts the role-token rewrite leaves alone (it does not apply to this template).
      if (applyV13Rewrites(CYCLE_TEMPLATE, base, { edgeViews: false, roleTokens: true }) === plain) {
        texts.set(plain, { name: CYCLE_TEMPLATE, filter: 'all', excludes });
      }
      if (literal !== plain && applyV13Rewrites(CYCLE_TEMPLATE, base, { edgeViews: true, roleTokens: true }) === literal) {
        texts.set(literal, { name: CYCLE_TEMPLATE, filter: 'literal', excludes });
      }
    }
  }
  texts.set(UNIVERSAL_METRIC_QUERIES.cyclicDependencyCount, { name: 'cyclicDependencyCount', filter: 'all', excludes: false });
  texts.set(UNIVERSAL_METRIC_QUERIES_LITERAL.cyclicDependencyCount, { name: 'cyclicDependencyCount', filter: 'literal', excludes: false });
  return texts;
}

const RECOGNISED = recognisedTexts();

/** The accelerated query this exact text is, or `undefined`. */
export function recogniseQuery(cypher: string): AcceleratedQuery | undefined {
  return RECOGNISED.get(cypher);
}

/** The recognised texts (tests and docs). */
export function acceleratedTexts(): ReadonlyMap<string, AcceleratedQuery> {
  return RECOGNISED;
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/**
 * The `globToRegex` output grammar: the anchors, escaped specials, the single-segment star, `.*`, the optional
 * directory group of `segmentGlobstar`, `.` and plain characters.
 * A pattern in this grammar means the same under Java's `String.matches` and JavaScript's anchored `RegExp.test`.
 */
const GLOB_REGEX_GRAMMAR = /^\^(?:\\[.+^${}()|[\]\\]|\[\^\/\]\*|\(\?:\.\*\/\)\?|\.\*|\.|[A-Za-z0-9_\-/@~ #!%&',;=:<>"`])*\$$/;

/** Compiled exclude patterns, or `undefined` when one falls outside the grammar. */
function compileExcludes(params: Readonly<Record<string, unknown>> | undefined): RegExp[] | undefined {
  const raw = params?.excludePatterns;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: RegExp[] = [];
  for (const p of raw) {
    if (typeof p !== 'string' || !PRINTABLE_ASCII.test(p) || !GLOB_REGEX_GRAMMAR.test(p)) return undefined;
    try {
      out.push(new RegExp(`^(?:${p})$`));
    } catch {
      return undefined;
    }
  }
  return out;
}

/** Element `i` of a list the caller indexes within bounds. */
function at<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new RangeError(`index ${String(i)} outside a list of ${String(list.length)}`);
  return v;
}

interface FilteredGraph {
  /** Outgoing relationships per node (filtered, self-loops included), as indexes into `mirror.rels`. */
  readonly out: readonly (readonly number[])[];
  readonly rels: readonly MirrorRel[];
}

/** The IMPORTS / RE_EXPORTS relationships of the view; `undefined` when a `viaReExport` value is not a boolean. */
function filtered(mirror: GraphMirror, filter: EdgeFilter): FilteredGraph | undefined {
  const out: number[][] = Array.from({ length: mirror.nodeCount }, () => []);
  const rels: MirrorRel[] = [];
  for (const rel of mirror.rels) {
    if (filter === 'literal') {
      const via = rel.viaReExport;
      if (via !== undefined && via !== null && typeof via !== 'boolean') return undefined;
      if (via === true) continue;
    }
    at(out, rel.source).push(rels.length);
    rels.push(rel);
  }
  return { out, rels };
}

/** Strongly connected components (iterative Tarjan) over `adj`; returns the component id of every node. */
export function componentIds(adj: readonly (readonly number[])[]): Int32Array {
  const n = adj.length;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const comp = new Int32Array(n).fill(-1);
  const onStack = new Uint8Array(n);
  const next = new Int32Array(n);
  const stack: number[] = [];
  const work: number[] = [];
  let counter = 0;
  let comps = 0;
  const open = (v: number): void => {
    index[v] = counter;
    low[v] = counter;
    counter += 1;
    stack.push(v);
    onStack[v] = 1;
    work.push(v);
  };
  for (let root = 0; root < n; root += 1) {
    if ((index[root] ?? 0) !== -1) continue;
    open(root);
    while (work.length > 0) {
      const v = at(work, work.length - 1);
      const nbrs = at(adj, v);
      const i = next[v] ?? 0;
      if (i < nbrs.length) {
        next[v] = i + 1;
        const w = at(nbrs, i);
        if ((index[w] ?? 0) === -1) open(w);
        else if (onStack[w] === 1 && (index[w] ?? 0) < (low[v] ?? 0)) low[v] = index[w] ?? 0;
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined && (low[v] ?? 0) < (low[parent] ?? 0)) low[parent] = low[v] ?? 0;
      if (low[v] === index[v]) {
        for (let w = stack.pop(); w !== undefined; w = stack.pop()) {
          onStack[w] = 0;
          comp[w] = comps;
          if (w === v) break;
        }
        comps += 1;
      }
    }
  }
  return comp;
}

/** Node adjacency (distinct targets, self-loops dropped) over the kept nodes. */
function simpleAdjacency(nodeCount: number, g: FilteredGraph, keep: (node: number) => boolean): number[][] {
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  for (let v = 0; v < nodeCount; v += 1) {
    if (!keep(v)) continue;
    const seen = new Set<number>();
    const list = at(adj, v);
    for (const r of at(g.out, v)) {
      const t = at(g.rels, r).target;
      if (t === v || !keep(t) || seen.has(t)) continue;
      seen.add(t);
      list.push(t);
    }
  }
  return adj;
}

/** Sizes of the components, by component id. */
function componentSizes(comp: Int32Array, counted: (v: number) => boolean): Map<number, number> {
  const sizes = new Map<number, number>();
  comp.forEach((c, v) => {
    if (counted(v)) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  });
  return sizes;
}

/** FF-S02 rows, or `undefined` outside the guards. */
export function noCyclicDepsRows(
  mirror: GraphMirror,
  filter: EdgeFilter,
  params: Readonly<Record<string, unknown>> | undefined,
  excludes: boolean,
  budget: number = CYCLE_STEP_BUDGET,
): Row[] | undefined {
  const g = filtered(mirror, filter);
  if (g === undefined) return undefined;
  const patterns = excludes ? compileExcludes(params) : [];
  if (patterns === undefined) return undefined;
  const n = mirror.nodeCount;

  // Guards on every node that can sit on a cycle (it has an outgoing relationship of the view).
  const paths: string[] = new Array<string>(n).fill('');
  const seenPaths = new Set<string>();
  for (let v = 0; v < n; v += 1) {
    if (at(g.out, v).length === 0) continue;
    const fp = mirror.filePaths[v];
    if (mirror.labels[v] !== 'File' || typeof fp !== 'string' || !PRINTABLE_ASCII.test(fp) || seenPaths.has(fp)) return undefined;
    seenPaths.add(fp);
    paths[v] = fp;
  }
  for (const rel of g.rels) {
    const line = rel.line;
    if (line !== undefined && line !== null && (typeof line !== 'number' || !Number.isFinite(line))) return undefined;
  }

  const path = (v: number): string => at(paths, v);
  const byPath = (a: number, b: number): number => (path(a) < path(b) ? -1 : path(a) > path(b) ? 1 : 0);
  const keptMask = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) {
    if (at(g.out, v).length > 0 && !patterns.some((re) => re.test(path(v)))) keptMask[v] = 1;
  }
  const kept = (v: number): boolean => keptMask[v] === 1;
  const adj = simpleAdjacency(n, g, kept);
  for (const list of adj) list.sort(byPath);
  const comp = componentIds(adj);
  const sizes = componentSizes(comp, kept);

  // Reverse adjacency for the distance-to-start pruning.
  const radj: number[][] = Array.from({ length: n }, () => []);
  adj.forEach((list, v) => {
    for (const w of list) at(radj, w).push(v);
  });

  const starts: number[] = [];
  for (let v = 0; v < n; v += 1) if (kept(v) && (sizes.get(comp[v] ?? -1) ?? 0) >= 2) starts.push(v);
  starts.sort(byPath);

  const rows: Row[] = [];
  const limit = CYCLE_ROW_CAP + 1;
  const maxLen = MAX_CYCLE_LENGTH;
  const dist = new Int32Array(n).fill(-1);
  const onPath = new Uint8Array(n);
  let steps = 0;

  const firstLine = (f: number, n1: number): number | null => {
    let min: number | null = null;
    for (const r of at(g.out, f)) {
      const rel = at(g.rels, r);
      if (rel.target === n1 && typeof rel.line === 'number' && (min === null || rel.line < min)) min = rel.line;
    }
    return min;
  };

  for (const f of starts) {
    if (rows.length >= limit) break;
    const fPath = path(f);
    const c = comp[f] ?? -1;
    const allowed = (w: number): boolean => comp[w] === c && path(w) > fPath;
    // Distances to f over allowed nodes (reverse BFS), bounded by the cycle length.
    dist[f] = 0;
    const queue: number[] = [f];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const v = at(queue, qi);
      const dv = dist[v] ?? 0;
      if (dv >= maxLen - 1) continue;
      for (const u of at(radj, v)) {
        if (dist[u] !== -1 || !allowed(u)) continue;
        dist[u] = dv + 1;
        queue.push(u);
      }
    }

    // Iterative DFS. Frame k holds the path's k-th node, its next neighbour index, and whether its closing edge
    // (back to f) was tried; the closing edge comes first because f has the smallest filePath of the cycle.
    const pathNodes: number[] = [f];
    const nextIdx: number[] = [0];
    const closeTried: boolean[] = [true]; // no closing self-loop at depth 0
    onPath[f] = 1;
    let aborted = false;
    while (pathNodes.length > 0 && rows.length < limit) {
      const top = pathNodes.length - 1; // relationships on the path so far
      const v = at(pathNodes, top);
      const nbrs = at(adj, v);
      if (!at(closeTried, top)) {
        closeTried[top] = true;
        if (top >= 1 && top + 1 <= maxLen && nbrs.includes(f)) {
          const cycle = [...pathNodes.map(path), fPath];
          rows.push({ cycle, target: cycle[1], line: firstLine(f, at(pathNodes, 1)) });
          continue;
        }
      }
      let advanced = false;
      for (let i = at(nextIdx, top); i < nbrs.length; i += 1) {
        const w = at(nbrs, i);
        nextIdx[top] = i + 1;
        if (w === f || onPath[w] === 1 || !allowed(w)) continue;
        const d = dist[w] ?? -1;
        if (d < 1 || top + 1 + d > maxLen) continue;
        steps += 1;
        if (steps > budget) {
          aborted = true;
          break;
        }
        pathNodes.push(w);
        nextIdx.push(0);
        closeTried.push(false);
        onPath[w] = 1;
        advanced = true;
        break;
      }
      if (aborted) break;
      if (!advanced) {
        const done = pathNodes.pop();
        nextIdx.pop();
        closeTried.pop();
        if (done !== undefined) onPath[done] = 0;
      }
    }
    for (const v of pathNodes) onPath[v] = 0;
    for (const v of queue) dist[v] = -1;
    if (aborted) return undefined;
  }
  return rows;
}

/** `cyclicDependencyCount` rows (`[{ cnt }]`), or `undefined` outside the guards. */
export function cycleMetricRows(mirror: GraphMirror, filter: EdgeFilter): Row[] | undefined {
  const g = filtered(mirror, filter);
  if (g === undefined) return undefined;
  const n = mirror.nodeCount;
  const adj = simpleAdjacency(n, g, () => true);
  const comp = componentIds(adj);
  const sizes = componentSizes(comp, () => true);
  const dist = new Int32Array(n).fill(-1);
  let count = 0;
  for (let f = 0; f < n; f += 1) {
    if (mirror.labels[f] !== 'File') continue;
    let selfLoops = 0;
    for (const r of at(g.out, f)) if (at(g.rels, r).target === f) selfLoops += 1;
    if (selfLoops >= 2) {
      count += 1;
      continue;
    }
    const c = comp[f] ?? -1;
    if ((sizes.get(c) ?? 0) < 2) continue;
    // Shortest cycle through f: BFS from f inside its component; reaching f again closes it (adj has no self-loops,
    // so the closing relationship comes from a node at depth >= 1 and the cycle has >= 2 relationships).
    dist[f] = 0;
    const queue: number[] = [f];
    let found = false;
    for (let qi = 0; qi < queue.length && !found; qi += 1) {
      const v = at(queue, qi);
      const dv = dist[v] ?? 0;
      if (dv >= MAX_CYCLE_LENGTH) continue;
      for (const w of at(adj, v)) {
        if (w === f) {
          if (dv + 1 <= MAX_CYCLE_LENGTH) found = true;
          break;
        }
        if (dist[w] !== -1 || comp[w] !== c) continue;
        dist[w] = dv + 1;
        queue.push(w);
      }
    }
    for (const v of queue) dist[v] = -1;
    if (found) count += 1;
  }
  return [{ cnt: neo4j.int(count) }];
}

/** The rows of an accelerated query, or `undefined` when Neo4j must answer it. */
export function answer(mirror: GraphMirror, q: AcceleratedQuery, params: Readonly<Record<string, unknown>> | undefined): Row[] | undefined {
  if (mirror.state !== 'valid') return undefined;
  return q.name === 'no-cyclic-deps' ? noCyclicDepsRows(mirror, q.filter, params, q.excludes) : cycleMetricRows(mirror, q.filter);
}
