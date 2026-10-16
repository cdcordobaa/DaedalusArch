/**
 * A harness `GraphRepository` for long history walks (Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md §2.3):
 * the in-process Cypher interpreter (`MemoryGraphRepository`, engine `cypher-interp`) with two query texts answered by
 * an equivalent graph search instead of path enumeration. Everything else, including every other template, goes to the
 * interpreter unchanged. No Cypher template, tier or `src/` file is modified.
 *
 * Why: the interpreter expands `-[:IMPORTS|RE_EXPORTS*2..10]->` by enumerating every relationship-unique trail of up to
 * ten hops and filters afterwards. On a NestJS code base with module cycles that is exponential (one 214-file snapshot:
 * 55 s for the `no-cyclic-deps` template and 52 s for the `cyclicDependencyCount` universal metric, out of 120 s).
 *
 * The two texts (exactly as the pipeline sends them, after the edge-view rewrite):
 *   NO_CYCLIC_DEPS  - the FF-S02 template: simple cycles of length 2..10 through File `f`, every node's filePath >= f's,
 *                     one row per distinct node list, `min(relationships(p)[0].line)`, ORDER BY cycle, LIMIT 101.
 *                     Answered by a depth-first search from each File in filePath order over the nodes with a larger
 *                     filePath, neighbours in filePath order, closing edge first, pruned by a reverse BFS distance
 *                     bound. That order is the lexicographic order of the cycle lists, so the search stops at row 101.
 *   CYCLIC_COUNT    - the universal metric: Files with a closed relationship-unique walk of length 2..10. Answered as:
 *                     some out-neighbour s != f reaches f within 9 hops (a shortest path is simple), or f has at least
 *                     two self-loops (a closed trail decomposes into cycles; one through f has length >= 2 unless all
 *                     of them at f are self-loops).
 * Both read only IMPORTS / RE_EXPORTS relationships without `viaReExport = true`, as the texts do.
 *
 * Preconditions checked on every call (else the interpreter answers): every File node has a string filePath, and no
 * two File nodes share one. `parity` mode answers both ways and records any difference.
 */
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { toDriver } from '../../../src/cypher-interp/driver-values.js';
import { cypherOrder } from '../../../src/cypher-interp/values.js';
import type { GraphNode, GraphRel, Value } from '../../../src/cypher-interp/values.js';
import type { QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';

// The trailing space after `length(p)` is where the template's /*EXCLUDE:nodes(p)*/ marker was stripped.
export const NO_CYCLIC_DEPS = [
  'MATCH p = (f:File)-[_ev0:IMPORTS|RE_EXPORTS*2..10]->(f)',
  'WHERE ALL(_evr IN _ev0 WHERE NOT coalesce(_evr.viaReExport, false)) AND ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)',
  '  AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p) ',
  'WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine',
  'WITH cycle, min(firstLine) AS line',
  'RETURN cycle, cycle[1] AS target, line',
  'ORDER BY cycle',
  'LIMIT 101',
].join('\n');

export const CYCLIC_COUNT = 'MATCH (f:File) WHERE EXISTS { MATCH p = (f)-[:IMPORTS|RE_EXPORTS*2..10]->(f) WHERE ALL(r IN relationships(p) WHERE NOT coalesce(r.viaReExport, false)) } RETURN count(f) AS cnt';

const MAX_LEN = 10;
const ROW_CAP = 101;

export interface FastCycleStats {
  fastCycles: number;
  fastCount: number;
  fallbacks: number;
  parityChecks: number;
  parityMismatches: string[];
}

const usable = (r: GraphRel): boolean => (r.type === 'IMPORTS' || r.type === 'RE_EXPORTS') && r.properties.get('viaReExport') !== true;

export class FastCycleRepository extends MemoryGraphRepository {
  readonly stats: FastCycleStats = { fastCycles: 0, fastCount: 0, fallbacks: 0, parityChecks: 0, parityMismatches: [] };

  constructor(private readonly parity = false) {
    super();
  }

  override async executeQuery(cypher: string, params?: Record<string, unknown>, options?: QueryOptions): Promise<DomainResult<QueryResult>> {
    const which = cypher === NO_CYCLIC_DEPS ? 'cycles' : cypher === CYCLIC_COUNT ? 'count' : undefined;
    if (which === undefined || !this.preconditions()) {
      if (which !== undefined) this.stats.fallbacks++;
      return super.executeQuery(cypher, params, options);
    }
    const records = which === 'cycles' ? this.cycles() : this.count();
    if (which === 'cycles') this.stats.fastCycles++; else this.stats.fastCount++;
    if (this.parity) {
      this.stats.parityChecks++;
      const ref = await super.executeQuery(cypher, params, options);
      const a = JSON.stringify(records);
      const b = ref.success ? JSON.stringify(ref.data.records) : `error ${JSON.stringify(ref.errors)}`;
      if (a !== b) this.stats.parityMismatches.push(`${which}: fast ${a.slice(0, 300)} | interp ${b.slice(0, 300)}`);
    }
    return DomainResult.ok({ records, summary: { counters: { nodesCreated: 0, nodesDeleted: 0, relationshipsCreated: 0, relationshipsDeleted: 0, propertiesSet: 0, labelsAdded: 0, labelsRemoved: 0, indexesAdded: 0, indexesRemoved: 0, constraintsAdded: 0, constraintsRemoved: 0 } } });
  }

  private files(): GraphNode[] {
    return this.graph.nodesWithLabel('File') as GraphNode[];
  }

  private preconditions(): boolean {
    const seen = new Set<string>();
    for (const f of this.files()) {
      const p = f.properties.get('filePath');
      if (typeof p !== 'string' || seen.has(p)) return false;
      seen.add(p);
    }
    return true;
  }

  /** Out-neighbours over usable relationships (distinct nodes, self excluded) and, per neighbour, its relationships. */
  private outRels(n: GraphNode): Map<GraphNode, GraphRel[]> {
    const out = new Map<GraphNode, GraphRel[]>();
    for (const r of this.graph.outgoing(n)) {
      if (!usable(r)) continue;
      const list = out.get(r.end) ?? [];
      list.push(r);
      out.set(r.end, list);
    }
    return out;
  }

  /** Reverse BFS distances to `target` over usable relationships, restricted to `allowed` nodes, up to `maxDepth`. */
  private distTo(target: GraphNode, maxDepth: number, allowed: (n: GraphNode) => boolean): Map<GraphNode, number> {
    const dist = new Map<GraphNode, number>([[target, 0]]);
    let frontier = [target];
    for (let d = 1; d <= maxDepth && frontier.length > 0; d++) {
      const next: GraphNode[] = [];
      for (const n of frontier) {
        for (const r of this.graph.incoming(n)) {
          if (!usable(r)) continue;
          const s = r.start;
          if (dist.has(s) || !allowed(s)) continue;
          dist.set(s, d);
          next.push(s);
        }
      }
      frontier = next;
    }
    return dist;
  }

  private cycles(): Record<string, unknown>[] {
    const fp = (n: GraphNode): Value => n.properties.get('filePath') ?? null;
    const byPath = (a: GraphNode, b: GraphNode): number => cypherOrder(fp(a), fp(b));
    const starts = [...this.files()].sort(byPath);
    const rows: { cycle: string[]; line: Value }[] = [];
    for (const f of starts) {
      if (rows.length >= ROW_CAP) break;
      const fPath = fp(f) as string;
      // Every node on the cycle has filePath >= f's; distinct from f, so strictly greater (filePaths are unique among
      // Files; a non-File node with an equal or missing filePath fails the comparison or is excluded the same way).
      const allowed = (n: GraphNode): boolean => {
        const p = fp(n);
        return typeof p === 'string' && cypherOrder(p, fPath) > 0;
      };
      const dist = this.distTo(f, MAX_LEN - 1, allowed);
      const firstRels = this.outRels(f);
      const path: GraphNode[] = [f];
      const onPath = new Set<GraphNode>([f]);
      const dfs = (n: GraphNode): void => {
        if (rows.length >= ROW_CAP) return;
        const depth = path.length - 1; // relationships so far
        const nbrs = this.outRels(n);
        // Closing edge first: [.., n, f] sorts before any [.., n, m, ..] since f's filePath is the smallest.
        if (depth >= 1 && nbrs.has(f)) {
          const n1 = path[1] as GraphNode;
          let line: Value = null;
          for (const r of firstRels.get(n1) ?? []) {
            const v = r.properties.get('line') ?? null;
            if (v !== null && (line === null || cypherOrder(v, line) < 0)) line = v;
          }
          rows.push({ cycle: [...path, f].map((x) => fp(x) as string), line });
          if (rows.length >= ROW_CAP) return;
        }
        if (depth + 1 >= MAX_LEN) return;
        const next = [...nbrs.keys()].filter((m) => !onPath.has(m) && allowed(m) && (dist.get(m) ?? Infinity) <= MAX_LEN - depth - 1).sort(byPath);
        for (const m of next) {
          path.push(m);
          onPath.add(m);
          dfs(m);
          path.pop();
          onPath.delete(m);
          if (rows.length >= ROW_CAP) return;
        }
      };
      dfs(f);
    }
    return rows.map((r) => ({ cycle: toDriver(r.cycle), target: toDriver(r.cycle[1] ?? null), line: toDriver(r.line) }));
  }

  private count(): Record<string, unknown>[] {
    let cnt = 0n;
    for (const f of this.files()) {
      let selfLoops = 0;
      const succ = new Set<GraphNode>();
      for (const r of this.graph.outgoing(f)) {
        if (!usable(r)) continue;
        if (r.end === f) selfLoops++; else succ.add(r.end);
      }
      if (selfLoops >= 2) { cnt++; continue; }
      if (succ.size === 0) continue;
      const dist = this.distTo(f, MAX_LEN - 1, () => true);
      if ([...succ].some((s) => (dist.get(s) ?? Infinity) <= MAX_LEN - 1)) cnt++;
    }
    return [{ cnt: toDriver(cnt) }];
  }
}
