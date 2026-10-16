/**
 * Shared helpers of the graph-accelerator tests: graphs built through the real ingestion writes, and brute-force
 * reference answers that follow the Cypher text literally (every relationship-distinct walk, then the WHERE, DISTINCT,
 * aggregation, ORDER BY and LIMIT clauses), independent of the optimised code under test.
 */
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { AcceleratedGraphRepository } from '../../../src/graph-accelerator/accelerated-repository.js';
import { ingestEdges, ingestNodes } from '../../../src/neo4j-ingestion/graph-ingester.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../../../src/fitness-compiler/cypher-templates.js';

export interface TestNode {
  readonly id: string;
  readonly type?: APGNode['type'];
  readonly filePath?: string;
}

export interface TestEdge {
  readonly from: string;
  readonly to: string;
  readonly type?: 'IMPORTS' | 'RE_EXPORTS' | 'CALLS';
  readonly line?: number;
  readonly viaReExport?: boolean;
}

/** An inner repository that accepts every query and reports no counters (the mirror then skips the counter check). */
export class RecordingRepository implements GraphRepository {
  readonly queries: string[] = [];
  constructor(private readonly reply: (cypher: string) => QueryResult = () => ({ records: [], summary: { counters: {} } })) {}
  async executeQuery(cypher: string): Promise<DomainResult<QueryResult>> {
    this.queries.push(cypher);
    return DomainResult.ok(this.reply(cypher));
  }
  async clearGraph(): Promise<DomainResult<void>> {
    return DomainResult.ok(undefined);
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
  async close(): Promise<void> {}
}

export function apgNode(n: TestNode): APGNode {
  const filePath = n.filePath ?? `src/${n.id}.ts`;
  return { id: n.id, type: n.type ?? 'File', name: n.id, filePath, decorators: [], properties: {} };
}

export function apgEdge(e: TestEdge, i: number): APGEdge {
  const properties: Record<string, unknown> = {};
  if (e.line !== undefined) properties['line'] = e.line;
  if (e.viaReExport !== undefined) properties['viaReExport'] = e.viaReExport;
  return { id: `e${String(i)}`, type: e.type ?? 'IMPORTS', sourceId: e.from, targetId: e.to, properties };
}

/** An accelerated repository whose mirror holds the graph, written through `ingestNodes` / `ingestEdges`. */
export async function mirrored(nodes: readonly TestNode[], edges: readonly TestEdge[]): Promise<AcceleratedGraphRepository> {
  const repo = new AcceleratedGraphRepository(new RecordingRepository());
  await repo.clearGraph();
  await ingestNodes(nodes.map(apgNode), new Map(), repo);
  await ingestEdges(edges.map(apgEdge), repo);
  return repo;
}

// ── Brute-force references ───────────────────────────────────────────────────

interface Rel { readonly from: number; readonly to: number; readonly line: number | null; readonly via: boolean }

function relsOf(nodes: readonly TestNode[], edges: readonly TestEdge[], literal: boolean): Rel[] {
  const index = new Map<string, number[]>();
  nodes.forEach((n, i) => index.set(n.id, [...(index.get(n.id) ?? []), i]));
  const rels: Rel[] = [];
  for (const e of edges) {
    if ((e.type ?? 'IMPORTS') === 'CALLS') continue;
    if (literal && e.viaReExport === true) continue;
    for (const from of index.get(e.from) ?? []) {
      for (const to of index.get(e.to) ?? []) rels.push({ from, to, line: e.line ?? null, via: e.viaReExport === true });
    }
  }
  return rels;
}

/** Every relationship-distinct walk of 1..MAX relationships from `start`, as relationship index lists. */
function walks(rels: readonly Rel[], start: number, visit: (path: readonly number[], at: number) => boolean | void): void {
  const used = new Set<number>();
  const path: number[] = [];
  const go = (at: number): boolean => {
    if (path.length >= MAX_CYCLE_LENGTH) return false;
    for (let r = 0; r < rels.length; r += 1) {
      if (rels[r]!.from !== at || used.has(r)) continue;
      used.add(r);
      path.push(r);
      if (visit(path, rels[r]!.to) === true || go(rels[r]!.to)) return true;
      path.pop();
      used.delete(r);
    }
    return false;
  };
  go(start);
}

const cmpList = (a: readonly string[], b: readonly string[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return a.length - b.length;
};

/** FF-S02 rows by the letter of the template text. */
export function bruteForceCycles(
  nodes: readonly TestNode[],
  edges: readonly TestEdge[],
  literal: boolean,
  excludes: readonly RegExp[] = [],
): Record<string, unknown>[] {
  const rels = relsOf(nodes, edges, literal);
  const path = (i: number): string => apgNode(nodes[i]!).filePath;
  const groups = new Map<string, { cycle: string[]; lines: Set<number | null> }>();
  nodes.forEach((n, f) => {
    if ((n.type ?? 'File') !== 'File') return;
    walks(rels, f, (relPath, at) => {
      if (at !== f || relPath.length < 2) return;
      const nodeList = [f, ...relPath.map((r) => rels[r]!.to)];
      if (!nodeList.every((v) => path(v) >= path(f))) return;
      if (new Set(nodeList.slice(1)).size !== relPath.length) return;
      if (nodeList.some((v) => excludes.some((re) => re.test(path(v))))) return;
      const cycle = nodeList.map(path);
      const key = JSON.stringify(cycle);
      const g = groups.get(key) ?? { cycle, lines: new Set() };
      g.lines.add(rels[relPath[0]!]!.line);
      groups.set(key, g);
    });
  });
  return [...groups.values()]
    .map(({ cycle, lines }) => {
      const numeric = [...lines].filter((l): l is number => l !== null);
      return { cycle, target: cycle[1], line: numeric.length > 0 ? Math.min(...numeric) : null };
    })
    .sort((a, b) => cmpList(a.cycle, b.cycle))
    .slice(0, CYCLE_ROW_CAP + 1);
}

/** cyclicDependencyCount by the letter of the metric text: Files with a closed relationship-distinct walk of 2..MAX. */
export function bruteForceCycleCount(nodes: readonly TestNode[], edges: readonly TestEdge[], literal: boolean): number {
  const rels = relsOf(nodes, edges, literal);
  let count = 0;
  nodes.forEach((n, f) => {
    if ((n.type ?? 'File') !== 'File') return;
    let found = false;
    walks(rels, f, (relPath, at) => {
      if (at === f && relPath.length >= 2) {
        found = true;
        return true;
      }
      return false;
    });
    if (found) count += 1;
  });
  return count;
}

/** Seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small random graph: Files (some with a shared id), a Package, parallel edges, self-loops, lines, re-export flags. */
export function randomGraph(seed: number): { nodes: TestNode[]; edges: TestEdge[] } {
  const r = rng(seed);
  const fileCount = 3 + Math.floor(r() * 4);
  const nodes: TestNode[] = [];
  for (let i = 0; i < fileCount; i += 1) nodes.push({ id: `f${String(i)}`, filePath: `src/${String.fromCharCode(97 + Math.floor(r() * 26))}${String(i)}.ts` });
  nodes.push({ id: 'pkg', type: 'Package', filePath: '' });
  const edgeCount = 2 + Math.floor(r() * (fileCount * 2.5));
  const edges: TestEdge[] = [];
  for (let i = 0; i < edgeCount; i += 1) {
    const from = `f${String(Math.floor(r() * fileCount))}`;
    const to = r() < 0.08 ? 'pkg' : `f${String(Math.floor(r() * fileCount))}`;
    const kind = r();
    edges.push({
      from, to,
      type: kind < 0.75 ? 'IMPORTS' : kind < 0.95 ? 'RE_EXPORTS' : 'CALLS',
      ...(r() < 0.85 ? { line: 1 + Math.floor(r() * 40) } : {}),
      ...(r() < 0.25 ? { viaReExport: r() < 0.7 } : {}),
    });
  }
  return { nodes, edges };
}
