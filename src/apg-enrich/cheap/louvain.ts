/**
 * Louvain modularity communities (Blondel, Guillaume, Lambiotte and Lefebvre 2008) on a weighted undirected graph,
 * and the adjusted Rand index (Hubert and Arabie 1985). Deterministic: nodes are visited in input order, ties go to
 * the community seen first, so the same graph always gives the same partition. No dependency.
 */

export interface WeightedEdge {
  readonly a: string;
  readonly b: string;
  readonly w: number;
}

export interface LouvainResult {
  /** node → community index (0-based, in order of first member). */
  readonly community: ReadonlyMap<string, number>;
  readonly modularity: number;
  readonly levels: number;
}

/** Modularity of a partition: Σ_c (L_c / m − γ (d_c / 2m)²). */
export function modularity(nodes: readonly string[], edges: readonly WeightedEdge[], community: ReadonlyMap<string, number>, resolution = 1): number {
  let m = 0;
  const deg = new Map<string, number>(nodes.map((n) => [n, 0]));
  const inner = new Map<number, number>();
  for (const e of edges) {
    if (e.a === e.b) continue;
    m += e.w;
    deg.set(e.a, (deg.get(e.a) ?? 0) + e.w);
    deg.set(e.b, (deg.get(e.b) ?? 0) + e.w);
    const ca = community.get(e.a);
    if (ca !== undefined && ca === community.get(e.b)) inner.set(ca, (inner.get(ca) ?? 0) + e.w);
  }
  if (m === 0) return 0;
  const tot = new Map<number, number>();
  for (const n of nodes) {
    const c = community.get(n);
    if (c !== undefined) tot.set(c, (tot.get(c) ?? 0) + (deg.get(n) ?? 0));
  }
  let q = 0;
  for (const [c, d] of tot) q += (inner.get(c) ?? 0) / m - resolution * (d / (2 * m)) ** 2;
  return q;
}

function addWeight(g: Map<number, Map<number, number>>, a: number, b: number, w: number): void {
  let row = g.get(a);
  if (row === undefined) {
    row = new Map<number, number>();
    g.set(a, row);
  }
  row.set(b, (row.get(b) ?? 0) + w);
}

/** One local-moving pass plus aggregation, repeated until no node moves. */
export function louvain(nodes: readonly string[], edges: readonly WeightedEdge[], resolution = 1): LouvainResult {
  const index = new Map(nodes.map((n, i) => [n, i]));
  // Level graph: adjacency without self-loops, explicit degrees (self-loops of aggregated nodes are in the degree).
  let size = nodes.length;
  let adj = new Map<number, Map<number, number>>();
  let deg: number[] = new Array<number>(size).fill(0);
  let m2 = 0;
  for (const e of edges) {
    const a = index.get(e.a);
    const b = index.get(e.b);
    if (a === undefined || b === undefined || a === b || e.w <= 0) continue;
    addWeight(adj, a, b, e.w);
    addWeight(adj, b, a, e.w);
    deg[a] = (deg[a] ?? 0) + e.w;
    deg[b] = (deg[b] ?? 0) + e.w;
    m2 += 2 * e.w;
  }
  // membership of each original node in the current level's nodes
  let member: number[] = nodes.map((_, i) => i);
  let levels = 0;
  if (m2 > 0) {
    for (;;) {
      const comm = Array.from({ length: size }, (_, i) => i);
      const tot = [...deg];
      let moved = false;
      for (let changed = true; changed;) {
        changed = false;
        for (let i = 0; i < size; i++) {
          const ci = comm[i] ?? i;
          const ki = deg[i] ?? 0;
          const links = new Map<number, number>();
          for (const [j, w] of adj.get(i) ?? []) {
            const cj = comm[j] ?? j;
            links.set(cj, (links.get(cj) ?? 0) + w);
          }
          tot[ci] = (tot[ci] ?? 0) - ki;
          let best = ci;
          let bestGain = (links.get(ci) ?? 0) - (resolution * (tot[ci] ?? 0) * ki) / m2;
          for (const [c, kin] of links) {
            const gain = kin - (resolution * (tot[c] ?? 0) * ki) / m2;
            if (gain > bestGain + 1e-12) {
              best = c;
              bestGain = gain;
            }
          }
          tot[best] = (tot[best] ?? 0) + ki;
          if (best !== ci) {
            comm[i] = best;
            changed = true;
            moved = true;
          }
        }
      }
      if (!moved) break;
      levels++;
      // Renumber communities in order of first node, aggregate.
      const renum = new Map<number, number>();
      for (const c of comm) if (!renum.has(c)) renum.set(c, renum.size);
      const nextSize = renum.size;
      const nextAdj = new Map<number, Map<number, number>>();
      const nextDeg: number[] = new Array<number>(nextSize).fill(0);
      for (let i = 0; i < size; i++) {
        const ci = renum.get(comm[i] ?? i) ?? 0;
        nextDeg[ci] = (nextDeg[ci] ?? 0) + (deg[i] ?? 0);
        for (const [j, w] of adj.get(i) ?? []) {
          const cj = renum.get(comm[j] ?? j) ?? 0;
          if (ci !== cj) addWeight(nextAdj, ci, cj, w);
        }
      }
      member = member.map((x) => renum.get(comm[x] ?? x) ?? 0);
      adj = nextAdj;
      deg = nextDeg;
      size = nextSize;
    }
  }
  const renum = new Map<number, number>();
  const community = new Map<string, number>();
  nodes.forEach((n, i) => {
    const c = member[i] ?? i;
    if (!renum.has(c)) renum.set(c, renum.size);
    community.set(n, renum.get(c) ?? 0);
  });
  return { community, modularity: modularity(nodes, edges, community, resolution), levels };
}

const choose2 = (n: number): number => (n * (n - 1)) / 2;

/** Adjusted Rand index of two labelings of the same items (items missing from either are skipped). */
export function adjustedRandIndex(a: ReadonlyMap<string, string | number>, b: ReadonlyMap<string, string | number>): number {
  const items = [...a.keys()].filter((k) => b.has(k));
  const n = items.length;
  if (n < 2) return 1;
  const cell = new Map<string, number>();
  const ra = new Map<string, number>();
  const rb = new Map<string, number>();
  for (const k of items) {
    const x = String(a.get(k));
    const y = String(b.get(k));
    cell.set(`${x}\u0000${y}`, (cell.get(`${x}\u0000${y}`) ?? 0) + 1);
    ra.set(x, (ra.get(x) ?? 0) + 1);
    rb.set(y, (rb.get(y) ?? 0) + 1);
  }
  const index = [...cell.values()].reduce((s, v) => s + choose2(v), 0);
  const sa = [...ra.values()].reduce((s, v) => s + choose2(v), 0);
  const sb = [...rb.values()].reduce((s, v) => s + choose2(v), 0);
  const expected = (sa * sb) / choose2(n);
  const max = (sa + sb) / 2;
  if (max === expected) return index === expected ? 1 : 0;
  return (index - expected) / (max - expected);
}
