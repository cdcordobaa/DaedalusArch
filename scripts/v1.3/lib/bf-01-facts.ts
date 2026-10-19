/**
 * BF-01 fact surface (ops/notes/bf-01-brownfield-norm-derivation.md §5): a spec-free, read-only view of the parser
 * graph A1 of one project, held in the in-process Cypher interpreter (`MemoryGraphRepository`, engine cypher-interp).
 *
 * The graph is the APG extractor's output with the v1.3 default options, ingested with an EMPTY layer model: no layer,
 * no role, no N1/A2 fact, so nothing here restates a spec or a mined rule. Every fixed tool is one Cypher read on that
 * graph plus a JS aggregation; `query_graph` runs any read-only Cypher with a row cap. The same functions re-run the
 * stat citations of `bf-01-verify-evidence.ts`, so a citation is checked on the graph the model queried.
 *
 * No Neo4j, no model call, no write to the project.
 */
import * as path from 'node:path';
import { extractAPG, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/index.js';
import { ingestAPG } from '../../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import type { SnapshotStore } from '../../../src/shared/interfaces/snapshot-store.js';

export const FACTS_SERVER = 'daedalus-facts';
export const FACT_TOOLS: readonly string[] = Object.freeze([
  'folder_dependency_matrix',
  'fan_in',
  'class_suffix_stats',
  'implements_by_folder',
  'query_graph',
]);
export const ROW_CAP = 200;
export const QUERY_TIMEOUT_MS = 10_000;

/** Write or procedure clauses: a query naming any of them is refused (the graph is read-only for the model). */
const WRITE_RE = /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|LOAD|CALL|FOREACH|UNWIND\s+\$batch)\b/i;

export interface FactsGraph {
  readonly repo: MemoryGraphRepository;
  readonly files: number;
  readonly buildMs: number;
}

const nullStore = {} as SnapshotStore;

export async function buildFactsGraph(projectRoot: string): Promise<FactsGraph> {
  const t0 = Date.now();
  const apg = await extractAPG(path.resolve(projectRoot), { ...V13_DEFAULT_OPTIONS });
  if (!apg.success) throw new Error(`extract failed: ${apg.errors.map((e) => e.code).join(', ')}`);
  const repo = new MemoryGraphRepository({ queryTimeoutMs: QUERY_TIMEOUT_MS });
  const ing = await ingestAPG({ apgResult: apg.data, layerModel: { layers: [] }, mode: 'stateless' }, repo, nullStore);
  if (!ing.success) throw new Error(`ingest failed: ${ing.errors.map((e) => e.code).join(', ')}`);
  const files = apg.data.nodes.filter((n) => n.type === 'File').length;
  return { repo, files, buildMs: Date.now() - t0 };
}

/** neo4j-style Integer `{low, high}` and nested values to plain JSON. */
export function plain(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.low === 'number' && typeof o.high === 'number' && Object.keys(o).length <= 2) return o.low + o.high * 2 ** 32;
    if (typeof (o as { toNumber?: unknown }).toNumber === 'function') return (o as { toNumber: () => number }).toNumber();
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

export type Rows = Record<string, unknown>[];

export async function readOnlyQuery(g: FactsGraph, cypher: string, cap = ROW_CAP): Promise<{ rows: Rows; truncated: boolean; total: number }> {
  if (typeof cypher !== 'string' || cypher.trim() === '') throw new Error('empty query');
  if (WRITE_RE.test(cypher)) throw new Error('read-only: CREATE, MERGE, DELETE, SET, REMOVE, DROP, LOAD, CALL and FOREACH are refused');
  const r = await g.repo.executeQuery(cypher, {}, { timeoutMs: QUERY_TIMEOUT_MS });
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  const rows = r.data.records.map((x) => plain(x) as Record<string, unknown>);
  return { rows: rows.slice(0, cap), truncated: rows.length > cap, total: rows.length };
}

function folderOf(file: string, depth: number): string {
  const parts = file.split('/');
  parts.pop();
  return parts.length === 0 ? '.' : parts.slice(0, Math.max(1, depth)).join('/');
}

const under = (prefix: string | undefined) => (f: string): boolean => prefix === undefined || prefix === '' || f === prefix || f.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);

/** Import edges between folders (file-to-file, and file-to-package when asked), at a folder depth. */
export async function folderDependencyMatrix(g: FactsGraph, a: { depth?: number; prefix?: string; include_packages?: boolean }): Promise<unknown> {
  const depth = a.depth ?? 2;
  const inPrefix = under(a.prefix);
  const ff = await readOnlyQuery(g, 'MATCH (a:File)-[r:IMPORTS]->(b:File) RETURN a.filePath AS a, b.filePath AS b, r.isTypeOnly AS t', 100_000);
  const cells = new Map<string, { edges: number; typeOnly: number; files: Set<string> }>();
  for (const r of ff.rows) {
    const s = String(r.a);
    if (!inPrefix(s)) continue;
    const key = `${folderOf(s, depth)}\u0000${folderOf(String(r.b), depth)}`;
    const c = cells.get(key) ?? { edges: 0, typeOnly: 0, files: new Set<string>() };
    c.edges++;
    if (r.t === true) c.typeOnly++;
    c.files.add(s);
    cells.set(key, c);
  }
  const pk = new Map<string, { edges: number; files: Set<string> }>();
  if (a.include_packages !== false) {
    const fp = await readOnlyQuery(g, 'MATCH (a:File)-[:IMPORTS]->(p:Package) RETURN a.filePath AS a, p.name AS p', 100_000);
    for (const r of fp.rows) {
      const s = String(r.a);
      if (!inPrefix(s)) continue;
      const key = `${folderOf(s, depth)}\u0000${String(r.p)}`;
      const c = pk.get(key) ?? { edges: 0, files: new Set<string>() };
      c.edges++;
      c.files.add(s);
      pk.set(key, c);
    }
  }
  const rows = [...cells].map(([k, v]) => { const [from, to] = k.split('\u0000'); return { from, to, edges: v.edges, typeOnlyEdges: v.typeOnly, importingFiles: v.files.size }; })
    .sort((x, y) => y.edges - x.edges || (x.from + x.to).localeCompare(y.from + y.to));
  const pkgRows = [...pk].map(([k, v]) => { const [from, pkg] = k.split('\u0000'); return { from, package: pkg, edges: v.edges, importingFiles: v.files.size }; })
    .sort((x, y) => y.edges - x.edges || (x.from + x.package).localeCompare(y.from + y.package));
  return { depth, prefix: a.prefix ?? '', folderEdges: rows.slice(0, ROW_CAP), folderEdgesTotal: rows.length, packageImports: pkgRows.slice(0, ROW_CAP), packageImportsTotal: pkgRows.length };
}

/** Files ranked by how many distinct files import them. */
export async function fanIn(g: FactsGraph, a: { top?: number; prefix?: string }): Promise<unknown> {
  const top = Math.min(a.top ?? 20, ROW_CAP);
  const r = await readOnlyQuery(g, 'MATCH (a:File)-[:IMPORTS]->(b:File) RETURN b.filePath AS f, count(DISTINCT a) AS n', 100_000);
  const rows = r.rows.filter((x) => under(a.prefix)(String(x.f))).map((x) => ({ file: String(x.f), importers: Number(x.n) }))
    .sort((x, y) => y.importers - x.importers || x.file.localeCompare(y.file));
  return { rows: rows.slice(0, top), total: rows.length };
}

function nameSuffix(name: string): string {
  const m = /([A-Z][a-z0-9]*|[a-z0-9]+)$/.exec(name);
  return m === null ? name : m[1] ?? name;
}

function fileSuffix(file: string): string {
  const base = file.split('/').pop() ?? file;
  const m = /[.-]([A-Za-z0-9]+)\.ts$/.exec(base);
  return m === null ? '(none)' : m[1] ?? '(none)';
}

/** Per folder: the last CamelCase word of declared class and interface names, and the file-name suffix. */
export async function classSuffixStats(g: FactsGraph, a: { depth?: number; prefix?: string }): Promise<unknown> {
  const depth = a.depth ?? 2;
  const inPrefix = under(a.prefix);
  const decl = await readOnlyQuery(g, 'MATCH (f:File)-[:DECLARES]->(c) WHERE c:Class OR c:Interface RETURN f.filePath AS f, c.name AS n, labels(c) AS l', 100_000);
  const files = await readOnlyQuery(g, 'MATCH (f:File) RETURN f.filePath AS f', 100_000);
  const cls = new Map<string, number>();
  for (const r of decl.rows) {
    const f = String(r.f);
    if (!inPrefix(f)) continue;
    const kind = Array.isArray(r.l) && r.l.includes('Interface') ? 'interface' : 'class';
    const key = `${folderOf(f, depth)}\u0000${kind}\u0000${nameSuffix(String(r.n))}`;
    cls.set(key, (cls.get(key) ?? 0) + 1);
  }
  const fsx = new Map<string, number>();
  for (const r of files.rows) {
    const f = String(r.f);
    if (!inPrefix(f)) continue;
    const key = `${folderOf(f, depth)}\u0000${fileSuffix(f)}`;
    fsx.set(key, (fsx.get(key) ?? 0) + 1);
  }
  const declRows = [...cls].map(([k, n]) => { const [folder, kind, suffix] = k.split('\u0000'); return { folder, kind, suffix, count: n }; })
    .sort((x, y) => y.count - x.count || (x.folder + x.suffix).localeCompare(y.folder + y.suffix));
  const fileRows = [...fsx].map(([k, n]) => { const [folder, suffix] = k.split('\u0000'); return { folder, fileSuffix: suffix, files: n }; })
    .sort((x, y) => y.files - x.files || (x.folder + x.fileSuffix).localeCompare(y.folder + y.fileSuffix));
  return { depth, declarations: declRows.slice(0, ROW_CAP), declarationsTotal: declRows.length, fileSuffixes: fileRows.slice(0, ROW_CAP), fileSuffixesTotal: fileRows.length };
}

/** IMPLEMENTS and EXTENDS edges aggregated by (declaring folder of the class, folder of the target type). */
export async function implementsByFolder(g: FactsGraph, a: { depth?: number; prefix?: string }): Promise<unknown> {
  const depth = a.depth ?? 2;
  const r = await readOnlyQuery(g, 'MATCH (c)-[r]->(i) WHERE type(r) IN [\'IMPLEMENTS\', \'EXTENDS\'] RETURN type(r) AS t, c.filePath AS a, i.filePath AS b', 100_000);
  const m = new Map<string, number>();
  for (const x of r.rows) {
    const s = String(x.a);
    if (!under(a.prefix)(s) || x.b === null) continue;
    const key = `${String(x.t)}\u0000${folderOf(s, depth)}\u0000${folderOf(String(x.b), depth)}`;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  const rows = [...m].map(([k, n]) => { const [relation, from, to] = k.split('\u0000'); return { relation, from, to, count: n }; })
    .sort((x, y) => y.count - x.count || (x.from + x.to).localeCompare(y.from + y.to));
  return { depth, rows: rows.slice(0, ROW_CAP), total: rows.length };
}

export const GRAPH_SCHEMA_NOTE =
  'Graph schema: node labels File, Class, Interface, Method, Function, Package (every node also has APGNode); ' +
  'properties filePath (relative to the analysis root, e.g. "src/app/x.ts") and name. Relationships: ' +
  '(File)-[:IMPORTS {specifier, isTypeOnly, line}]->(File|Package), (File)-[:DECLARES]->(Class|Interface|Function), ' +
  '(Class)-[:CONTAINS]->(Method), (Class)-[:EXTENDS|IMPLEMENTS]->(Class|Interface), (Class)-[:CONSTRUCTOR_INJECTS]->(Class|Interface), CALLS. ' +
  'The graph carries no layers and no rules.';
