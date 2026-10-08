import type { GraphRepository, QueryResult } from '../shared/interfaces/graph-repository.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { EXCERPT_EDGE_TYPES } from './frozen.js';

/**
 * Pure, in-memory view of the APG that the judge-unit selector and the graph excerpt read
 * (U4 plan Step 15; BR-U4-SEL-01, CTX-04). Neither ever takes a `GraphRepository`; the Cypher
 * reader that fills this view (`loadJudgeGraphView`) is added at Step 21.
 *
 * Node keys: a File or Package is keyed by its path (package name for a Package); a Class or
 * Interface by `${name}@${file}`. Edge endpoints use node keys. An endpoint that is no File,
 * Class or Interface of the view is a Package (external module).
 *
 * `loadJudgeGraphView` (U4 plan Step 21) fills the view from the ingested APG through
 * `GraphRepository.executeQuery`, read-only, every query ordered for determinism. Names follow
 * U2's ingestion (`graph-ingester.ts`): every node is `:APGNode:<type>` with `filePath`, `name`,
 * `layer` (null when unlayered) and the flattened `properties` (`isBarrel` on File nodes); a File
 * reaches its classes and interfaces through `DECLARES` (`CONTAINS` is Class/Interface → Method);
 * a Package node has `filePath: ''` and is keyed by `name`.
 */

export type JudgeEdgeType = (typeof EXCERPT_EDGE_TYPES)[number];

export interface JudgeGraphFile {
  readonly path: string;            // root-relative POSIX
  readonly layer: string | null;    // null: unlayered (BR-U4-SEL-01 'unlayered')
  readonly isBarrel: boolean;       // U2 `File.isBarrel`
}

export interface JudgeGraphType {
  readonly name: string;
  readonly file: string;            // root-relative POSIX path of the declaring file
}

export interface JudgeGraphEdge {
  readonly type: JudgeEdgeType;
  readonly from: string;            // node key
  readonly to: string;              // node key
}

export interface JudgeGraphView {
  readonly files: readonly JudgeGraphFile[];          // sorted by path
  readonly classes: readonly JudgeGraphType[];        // sorted by file, then name
  readonly interfaces: readonly JudgeGraphType[];     // sorted by file, then name
  readonly edges: readonly JudgeGraphEdge[];          // sorted by type, from, to
}

/** Node key of a Class or Interface (DE §3.2). */
export function typeKey(entry: JudgeGraphType): string {
  return `${entry.name}@${entry.file}`;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Returns a copy with every list in canonical order and duplicate edges removed. */
export function sortJudgeGraphView(view: JudgeGraphView): JudgeGraphView {
  const byFileName = (a: JudgeGraphType, b: JudgeGraphType): number =>
    compareStrings(a.file, b.file) || compareStrings(a.name, b.name);
  const edgeKey = (e: JudgeGraphEdge): string => `${e.type}\u0000${e.from}\u0000${e.to}`;
  const edges = new Map<string, JudgeGraphEdge>();
  for (const edge of view.edges) edges.set(edgeKey(edge), edge);
  return {
    files: [...view.files].sort((a, b) => compareStrings(a.path, b.path)),
    classes: [...view.classes].sort(byFileName),
    interfaces: [...view.interfaces].sort(byFileName),
    edges: [...edges.entries()].sort((a, b) => compareStrings(a[0], b[0])).map(([, e]) => e),
  };
}

// ── Cypher reader (Step 21) ──────────────────────────────────────────────────────────────

/** Read timeout of each view query (NFR-07); an operational value, not a frozen judge parameter. */
export const JUDGE_GRAPH_READ_TIMEOUT_MS = 60_000;

/** Node key of an edge endpoint (DE §3.2), computed in Cypher; `null` for any other node type. */
const KEY_OF = (v: string): string =>
  `CASE WHEN ${v}:File THEN ${v}.filePath`
  + ` WHEN ${v}:Class OR ${v}:Interface THEN ${v}.name + '@' + ${v}.filePath`
  + ` WHEN ${v}:Package THEN ${v}.name ELSE null END`;

/** The four read-only view queries, in execution order (asserted verbatim by the reader test). */
export const JUDGE_GRAPH_QUERIES = Object.freeze({
  files: 'MATCH (f:File) RETURN f.filePath AS path, f.layer AS layer, coalesce(f.isBarrel, false) AS isBarrel ORDER BY path',
  classes: 'MATCH (f:File)-[:DECLARES]->(c:Class) RETURN c.name AS name, f.filePath AS file ORDER BY file, name',
  interfaces: 'MATCH (f:File)-[:DECLARES]->(i:Interface) RETURN i.name AS name, f.filePath AS file ORDER BY file, name',
  edges: `MATCH (a)-[r:${EXCERPT_EDGE_TYPES.join('|')}]->(b)`
    + ` WITH type(r) AS type, ${KEY_OF('a')} AS from, ${KEY_OF('b')} AS to`
    + ' WHERE from IS NOT NULL AND to IS NOT NULL'
    + ' RETURN DISTINCT type, from, to ORDER BY type, from, to',
});

function stringField(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readFailure(query: string, message: string): DomainResult<JudgeGraphView> {
  return DomainResult.fail([{ code: 'CRITIC_001', message: `Judge graph view (${query}): ${message}`, context: { query } }]);
}

/**
 * Fills a `JudgeGraphView` from the ingested graph (four read-only queries, each with
 * `timeoutMs`). A query error or a malformed row is returned as `CRITIC_001`, never thrown; the
 * critic turns it into each affected function's failure (DE §4.5).
 */
export async function loadJudgeGraphView(
  repo: GraphRepository,
  timeoutMs: number = JUDGE_GRAPH_READ_TIMEOUT_MS,
): Promise<DomainResult<JudgeGraphView>> {
  const run = async (name: keyof typeof JUDGE_GRAPH_QUERIES): Promise<DomainResult<QueryResult>> => {
    try {
      return await repo.executeQuery(JUDGE_GRAPH_QUERIES[name], {}, { timeoutMs });
    } catch (e) {
      return DomainResult.fail([{ code: 'CRITIC_001', message: e instanceof Error ? e.message : String(e) }]);
    }
  };

  const files: JudgeGraphFile[] = [];
  const fileRows = await run('files');
  if (!fileRows.success) return readFailure('files', fileRows.errors[0]?.message ?? 'query failed');
  for (const r of fileRows.data.records) {
    const p = stringField(r, 'path');
    const layer = r.layer;
    if (p === null || (layer !== null && layer !== undefined && typeof layer !== 'string')) {
      return readFailure('files', 'row without a string path or with a non-string layer');
    }
    files.push({ path: p, layer: typeof layer === 'string' ? layer : null, isBarrel: r.isBarrel === true });
  }

  const types: Record<'classes' | 'interfaces', JudgeGraphType[]> = { classes: [], interfaces: [] };
  for (const name of ['classes', 'interfaces'] as const) {
    const rows = await run(name);
    if (!rows.success) return readFailure(name, rows.errors[0]?.message ?? 'query failed');
    for (const r of rows.data.records) {
      const typeName = stringField(r, 'name');
      const file = stringField(r, 'file');
      if (typeName === null || file === null) return readFailure(name, 'row without a string name or file');
      types[name].push({ name: typeName, file });
    }
  }

  const edges: JudgeGraphEdge[] = [];
  const edgeRows = await run('edges');
  if (!edgeRows.success) return readFailure('edges', edgeRows.errors[0]?.message ?? 'query failed');
  const allowed = new Set<string>(EXCERPT_EDGE_TYPES);
  for (const r of edgeRows.data.records) {
    const type = stringField(r, 'type');
    const from = stringField(r, 'from');
    const to = stringField(r, 'to');
    if (type === null || from === null || to === null || !allowed.has(type)) {
      return readFailure('edges', 'row without a known type or string endpoints');
    }
    edges.push({ type: type as JudgeEdgeType, from, to });
  }

  return DomainResult.ok(sortJudgeGraphView({ files, classes: types.classes, interfaces: types.interfaces, edges }));
}
