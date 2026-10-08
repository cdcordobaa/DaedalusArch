/**
 * New import cycles of a mutant and their U3 keys (FR-v1.2E-24; BR-U5a-13, BR-U5a-14 i; D-U5a-14).
 *
 * Graph: File→File `IMPORTS ∪ RE_EXPORTS` edges of the import graph (BR-U5a-56), one adjacency per (source, target)
 * whatever the edge type, as the U1 cycle query walks `[:IMPORTS|RE_EXPORTS*2..MAX_CYCLE_LENGTH]` and keeps
 * `DISTINCT` node lists (BR-U1-28).
 *
 * - **Simple cycles** (default strategy): a cycle has 2..`maxLength` edges and distinct nodes; it is rotated to start
 *   at its smallest `filePath` in code-unit order (Cypher string order) and closed by repeating the start
 *   (`[A, B, A]`). A cycle of `G'` is new when it is not a cycle of `G`; every such cycle uses at least one edge of
 *   `edges(G') − edges(G)`, so the enumeration runs a bounded DFS from the target of each new edge back to its
 *   source. Key (U3 domain-entities §1): `filePath = String(cycle)`, `target = cycle[1]`,
 *   `discriminator = [JSON.stringify(cycle)]`, `lineRule: 'first-edge-line'`, `line` = the smallest line of the
 *   `cycle[0] → cycle[1]` edges in `G'` (the query's `min(relationships(p)[0].line)`).
 * - **Cap** (BR-U5a-13): U3 keeps the first `CYCLE_ROW_CAP` rows only, so a site is rejected `cycle-cap` when the
 *   base already has `cap` or more simple cycles or base plus new cycles exceed `cap`. Counting stops once the
 *   answer is known (`limit`).
 * - **SCC fallback** (BR-U1-31, BR-U3-45): one key per strongly connected component of `G'` with two or more files
 *   that is new or changed, i.e. whose smallest member is not the smallest member of such a component of `G`:
 *   `filePath` = smallest member, `target = ''`, `discriminator = ['scc']`. Its `line` is the first-edge line of
 *   the representative cycle (BFS-shortest cycle through the smallest member, neighbours in ascending order, as
 *   U3's evidence cycle).
 *
 * Both `maxLength` and `cap` are parameters; callers pass U1's `MAX_CYCLE_LENGTH` / `CYCLE_ROW_CAP` (re-exported here). The
 * strategy is an explicit input with no default here (D-U5a-14).
 */
import type { CycleStrategy, ExpectedKey, ImportGraph } from './types.js';

/** U1's frozen bounds (BR-U1-28), wired into every caller of this module (Step 25). */
export { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `xs[i]`, throwing on a hole (the lint config forbids both `!` and `as` narrowing). */
function at<T>(xs: readonly T[], i: number): T {
  const v = xs[i];
  if (v === undefined) throw new Error(`cycles: no element at ${String(i)}`);
  return v;
}

/** `m.get(k)`, throwing when absent. */
function must<K, V>(m: ReadonlyMap<K, V>, k: K): V {
  const v = m.get(k);
  if (v === undefined) throw new Error(`cycles: missing entry ${String(k)}`);
  return v;
}

/** Element-wise code-unit order of two node lists (a prefix sorts first), as Cypher `ORDER BY` on lists. */
export function compareCycles(a: readonly string[], b: readonly string[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = cmp(at(a, i), at(b, i));
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

type Adjacency = ReadonlyMap<string, readonly string[]>;

/** Sorted, de-duplicated successor lists over `IMPORTS ∪ RE_EXPORTS` File→File edges. */
export function adjacencyOf(g: ImportGraph): Adjacency {
  const sets = new Map<string, Set<string>>();
  for (const e of g.edges) {
    let s = sets.get(e.source);
    if (s === undefined) {
      s = new Set();
      sets.set(e.source, s);
    }
    s.add(e.target);
  }
  const adj = new Map<string, string[]>();
  for (const [k, v] of sets) adj.set(k, [...v].sort(cmp));
  return adj;
}

function pairKey(source: string, target: string): string {
  return `${source}\u0000${target}`;
}

function pairsOf(adj: Adjacency): Set<string> {
  const out = new Set<string>();
  for (const [s, ts] of adj) for (const t of ts) out.add(pairKey(s, t));
  return out;
}

/** `edges(G') − edges(G)` as (source, target) pairs, sorted (type-insensitive, self-loops kept). */
export function newEdgePairs(base: ImportGraph, mutant: ImportGraph): { readonly source: string; readonly target: string }[] {
  const old = pairsOf(adjacencyOf(base));
  const out: { source: string; target: string }[] = [];
  for (const [s, ts] of adjacencyOf(mutant)) {
    for (const t of ts) if (!old.has(pairKey(s, t))) out.push({ source: s, target: t });
  }
  return out.sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target));
}

/** Rotates an open node list (no repeated start) to its smallest member and closes it. */
export function canonicalCycle(open: readonly string[]): string[] {
  let best = 0;
  for (let i = 1; i < open.length; i++) if (cmp(at(open, i), at(open, best)) < 0) best = i;
  const rotated = [...open.slice(best), ...open.slice(0, best)];
  return [...rotated, at(rotated, 0)];
}

/**
 * Simple cycles of `mutant` with 2..`maxLength` edges that are not cycles of `base`, canonical and closed, sorted
 * as `ORDER BY cycle`. Enumeration stops after `cap + 1` cycles (the cap is then reached whatever the base holds,
 * so the site is rejected and the list is not used further).
 */
export function newSimpleCycles(
  base: ImportGraph,
  mutant: ImportGraph,
  maxLength: number,
  cap: number,
): string[][] {
  const adj = adjacencyOf(mutant);
  const found = new Map<string, string[]>();
  const limit = cap + 1;
  for (const { source, target } of newEdgePairs(base, mutant)) {
    if (source === target) continue; // self-loops are not 2..maxLength cycles
    // Paths target → … → source with at most maxLength − 1 edges, simple, not revisiting `source` early.
    const pathNodes: string[] = [source, target];
    const onPath = new Set<string>(pathNodes);
    const dfs = (node: string): boolean => {
      if (found.size >= limit) return true;
      for (const next of adj.get(node) ?? []) {
        if (next === source) {
          const cycle = canonicalCycle(pathNodes);
          found.set(JSON.stringify(cycle), cycle);
          if (found.size >= limit) return true;
          continue;
        }
        if (onPath.has(next) || pathNodes.length >= maxLength) continue;
        pathNodes.push(next);
        onPath.add(next);
        const stop = dfs(next);
        pathNodes.pop();
        onPath.delete(next);
        if (stop) return true;
      }
      return false;
    };
    if (dfs(target)) break;
  }
  return [...found.values()].sort(compareCycles);
}

/**
 * Number of simple cycles of `g` with 2..`maxLength` edges, counted up to `limit` (each cycle once, from its
 * smallest member, through members larger than the start only).
 */
export function countSimpleCycles(g: ImportGraph, maxLength: number, limit: number): number {
  const adj = adjacencyOf(g);
  const nodes = [...adj.keys()].sort(cmp);
  let count = 0;
  for (const start of nodes) {
    const onPath = new Set<string>([start]);
    let depth = 0; // edges on the current path
    const dfs = (node: string): boolean => {
      for (const next of adj.get(node) ?? []) {
        if (next === start) {
          if (depth + 1 >= 2) {
            count++;
            if (count >= limit) return true;
          }
          continue;
        }
        if (cmp(next, start) < 0 || onPath.has(next) || depth + 1 >= maxLength) continue;
        onPath.add(next);
        depth++;
        const stop = dfs(next);
        depth--;
        onPath.delete(next);
        if (stop) return true;
      }
      return false;
    };
    if (dfs(start)) return count;
  }
  return count;
}

/** BR-U5a-13: `true` when the base already holds `cap` cycles or base plus new cycles exceed `cap`. */
export function cycleCapReached(baseCycles: number, newCycles: number, cap: number): boolean {
  return baseCycles >= cap || baseCycles + newCycles > cap;
}

/** Smallest line of the `source → target` edges (any type) in `g`. */
export function edgeLine(g: ImportGraph, source: string, target: string): number {
  let line: number | undefined;
  for (const e of g.edges) {
    if (e.source === source && e.target === target) line = line === undefined ? e.line : Math.min(line, e.line);
  }
  if (line === undefined) throw new Error(`cycles: no edge ${source} -> ${target}`);
  return line;
}

/** U3 key of one canonical, closed cycle (BR-U5a-14 i). */
export function cycleKey(functionId: string, cycle: readonly string[], line: number): ExpectedKey {
  if (cycle.length < 3 || cycle[0] !== cycle[cycle.length - 1]) throw new Error('cycleKey: cycle must be closed with at least two files');
  return {
    functionId,
    filePath: String(cycle),
    target: at(cycle, 1),
    discriminator: [JSON.stringify(cycle)],
    lineRule: 'first-edge-line',
    line,
  };
}

/** Strongly connected components with two or more files (Tarjan, iterative), each sorted, list sorted by first member. */
export function nonTrivialSccs(g: ImportGraph): string[][] {
  const adj = adjacencyOf(g);
  const nodes = new Set<string>();
  for (const [s, ts] of adj) {
    nodes.add(s);
    for (const t of ts) nodes.add(t);
  }
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];
  let next = 0;
  for (const root of [...nodes].sort(cmp)) {
    if (index.has(root)) continue;
    const work: { node: string; i: number }[] = [{ node: root, i: 0 }];
    index.set(root, next);
    low.set(root, next);
    next++;
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1] as { node: string; i: number };
      const succ = adj.get(frame.node) ?? [];
      if (frame.i < succ.length) {
        const w = at(succ, frame.i);
        frame.i++;
        if (!index.has(w)) {
          index.set(w, next);
          low.set(w, next);
          next++;
          stack.push(w);
          onStack.add(w);
          work.push({ node: w, i: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.node, Math.min(must(low, frame.node), must(index, w)));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) low.set(parent.node, Math.min(must(low, parent.node), must(low, frame.node)));
      if (low.get(frame.node) === index.get(frame.node)) {
        const comp: string[] = [];
        for (;;) {
          const w = stack.pop();
          if (w === undefined) throw new Error('cycles: Tarjan stack underflow');
          onStack.delete(w);
          comp.push(w);
          if (w === frame.node) break;
        }
        if (comp.length >= 2) out.push(comp.sort(cmp));
      }
    }
  }
  return out.sort((a, b) => cmp(at(a, 0), at(b, 0)));
}

/** BFS-shortest cycle through `start` inside `members`, neighbours in ascending order; closed. */
export function representativeCycle(g: ImportGraph, start: string, members: readonly string[]): string[] {
  const adj = adjacencyOf(g);
  const inScc = new Set(members);
  const parent = new Map<string, string>();
  const queue: string[] = [start];
  const seen = new Set<string>([start]);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) break;
    for (const nextNode of adj.get(node) ?? []) {
      if (!inScc.has(nextNode)) continue;
      if (nextNode === start) {
        const path: string[] = [node];
        let cur = node;
        while (cur !== start) {
          cur = must(parent, cur);
          path.push(cur);
        }
        path.reverse();
        return [...path, start];
      }
      if (seen.has(nextNode)) continue;
      seen.add(nextNode);
      parent.set(nextNode, node);
      queue.push(nextNode);
    }
  }
  throw new Error(`representativeCycle: ${start} is on no cycle`);
}

/** SCC-mode keys (BR-U1-31, BR-U3-45): one per new or changed non-trivial SCC of the mutant. */
export function sccKeys(functionId: string, base: ImportGraph, mutant: ImportGraph): ExpectedKey[] {
  const baseSmallest = new Set(nonTrivialSccs(base).map((c) => at(c, 0)));
  const keys: ExpectedKey[] = [];
  for (const comp of nonTrivialSccs(mutant)) {
    const smallest = at(comp, 0);
    if (baseSmallest.has(smallest)) continue;
    const rep = representativeCycle(mutant, smallest, comp);
    keys.push({
      functionId,
      filePath: smallest,
      target: '',
      discriminator: ['scc'],
      lineRule: 'first-edge-line',
      line: edgeLine(mutant, at(rep, 0), at(rep, 1)),
    });
  }
  return keys;
}

export interface SiteCycleOptions {
  /** Function id of the spec's `no-cyclic-deps` function (FF-S02 on the clean-architecture spec). */
  readonly functionId: string;
  readonly maxLength: number;
  readonly cap: number;
}

/** Site cycle keys of one application under the explicit strategy (D-U5a-14; no default). */
export function siteCycleKeys(
  base: ImportGraph,
  mutant: ImportGraph,
  strategy: CycleStrategy,
  options: SiteCycleOptions,
): ExpectedKey[] {
  switch (strategy) {
    case 'simple-cycles':
      return newSimpleCycles(base, mutant, options.maxLength, options.cap).map((c) =>
        cycleKey(options.functionId, c, edgeLine(mutant, at(c, 0), at(c, 1))));
    case 'scc':
      return sccKeys(options.functionId, base, mutant);
    default: {
      const never: never = strategy;
      throw new Error(`siteCycleKeys: unknown cycle strategy ${String(never)}`);
    }
  }
}
