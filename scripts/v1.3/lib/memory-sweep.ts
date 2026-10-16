/**
 * Differential parity machinery for the in-process graph engines (Docs/v1.3/cypher-interpreter.md §4).
 *
 * - `ParityTee`: a `GraphRepository` that sends every statement to the reference (Neo4j) and to the candidate
 *   (the interpreter's `MemoryGraphRepository`), records both outcomes and returns the REFERENCE result, so the
 *   pipeline under test runs exactly as on Neo4j and the candidate is judged on every query the pipeline issues.
 * - `classify`: equal | order | content | error | unsupported (| both-error) for one statement.
 * - `catalogueSweep`: every catalogue template, instantiated the four ways the compiler can emit it (exclude marker
 *   off/on × v1.2E text / v1.3 rewrites), with parameters bound from the project's spec, run through the tee.
 */
import neo4j from 'neo4j-driver';
import type { GraphRepository, QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { replaceExcludeMarkers } from '../../../src/fitness-compiler/exclude-injector.js';
import { applyV13Rewrites } from '../../../src/fitness-compiler/v13-rewrites.js';

export type ParityClass = 'equal' | 'order' | 'content' | 'error' | 'unsupported' | 'both-error';

export interface ParityEntry {
  readonly project: string;
  readonly phase: string;
  /** Template or query family name (assigned after the run for pipeline queries). */
  label: string;
  readonly cypher: string;
  readonly write: boolean;
  readonly klass: ParityClass;
  readonly refRows: number;
  readonly candRows: number;
  readonly refMs: number;
  readonly candMs: number;
  readonly detail?: string;
}

/** Driver value → canonical JSON-able form: INTEGER and FLOAT stay distinct, maps key-sorted, entities by content. */
export function canon(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (neo4j.isInt(v)) return { $int: (v as { toString(): string }).toString() };
  if (typeof v === 'number') return { $float: Number.isNaN(v) ? 'NaN' : Object.is(v, -0) ? '-0' : String(v) };
  if (typeof v === 'bigint') return { $int: v.toString() };
  if (typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  if (neo4j.isNode(v as never)) {
    const n = v as unknown as { labels: string[]; properties: Record<string, unknown> };
    return { $node: [...n.labels].sort(), props: canon(n.properties) };
  }
  if (neo4j.isRelationship(v as never)) {
    const r = v as unknown as { type: string; properties: Record<string, unknown> };
    return { $rel: r.type, props: canon(r.properties) };
  }
  if (neo4j.isPath(v as never)) {
    const p = v as unknown as { segments: { start: unknown; relationship: unknown; end: unknown }[]; start: unknown };
    return { $path: [canon(p.start), ...p.segments.flatMap((s) => [canon(s.relationship), canon(s.end)])] };
  }
  const o = v as Record<string, unknown>;
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
}

function rowsOf(r: QueryResult): string[] {
  return r.records.map((rec) => JSON.stringify(Object.entries(rec).map(([k, x]) => [k, canon(x)])));
}

export function classify(ref: DomainResult<QueryResult>, cand: DomainResult<QueryResult>, write: boolean, cypher = ''): { klass: ParityClass; detail?: string } {
  if (!ref.success || !cand.success) {
    const refMsg = ref.success ? '' : ref.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    const candMsg = cand.success ? '' : cand.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    if (!cand.success && cand.errors.some((e) => e.code === 'CypherInterp.Unsupported')) return { klass: 'unsupported', detail: candMsg };
    if (!ref.success && !cand.success) return { klass: 'both-error', detail: `neo4j: ${refMsg} | interp: ${candMsg}` };
    return { klass: 'error', detail: ref.success ? `interp: ${candMsg}` : `neo4j only: ${refMsg}` };
  }
  if (write) {
    const keys = ['nodesCreated', 'relationshipsCreated'] as const;
    const diff = keys.filter((k) => (ref.data.summary.counters[k] ?? 0) !== (cand.data.summary.counters[k] ?? 0));
    return diff.length === 0 ? { klass: 'equal' } : { klass: 'content', detail: `counters differ: ${diff.join(', ')}` };
  }
  const a = rowsOf(ref.data);
  const b = rowsOf(cand.data);
  if (a.length === b.length && a.every((x, i) => x === b[i])) return { klass: 'equal' };
  const sa = [...a].sort();
  const sb = [...b].sort();
  if (sa.length === sb.length && sa.every((x, i) => x === sb[i])) return { klass: 'order' };
  // Trap T2: an aggregate over rows in Neo4j's unspecified order (`avg`, `sum` of floats) can differ in the last bits
  // with the row order alone; Neo4j itself returns different last bits for the same graph after a re-ingestion
  // (node ids are reused). Rows equal up to 4 ULP on floats, from a query with such an aggregate, are `order`.
  if (/\b(avg|sum)\s*\(/i.test(cypher) && floatClose(ref.data, cand.data)) return { klass: 'order', detail: 'float accumulation order (<= 4 ULP)' };
  const onlyRef = sa.filter((x) => !sb.includes(x)).slice(0, 3);
  const onlyCand = sb.filter((x) => !sa.includes(x)).slice(0, 3);
  return { klass: 'content', detail: `rows ${String(a.length)} vs ${String(b.length)}; only neo4j: ${onlyRef.join(' ')}; only interp: ${onlyCand.join(' ')}`.slice(0, 2000) };
}

function close(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) <= 4 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => close(x, b[i]));
  if (neo4j.isInt(a) || neo4j.isInt(b)) return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

/** Same rows in the same order, floats equal up to 4 ULP. */
function floatClose(a: QueryResult, b: QueryResult): boolean {
  return a.records.length === b.records.length && a.records.every((r, i) => close(r, b.records[i]));
}

const WRITE_RE = /^\s*(UNWIND \$batch|MATCH \(n\) DETACH DELETE|CREATE INDEX|CALL db\.awaitIndexes)/;

export class ParityTee implements GraphRepository {
  readonly entries: ParityEntry[] = [];
  project = '';
  phase = '';

  constructor(private readonly reference: GraphRepository, private readonly candidate: GraphRepository) {}

  async executeQuery(cypher: string, params?: Record<string, unknown>, options?: QueryOptions): Promise<DomainResult<QueryResult>> {
    const t0 = performance.now();
    const ref = await this.reference.executeQuery(cypher, params, options);
    const t1 = performance.now();
    const cand = await this.candidate.executeQuery(cypher, params, options);
    const t2 = performance.now();
    const write = WRITE_RE.test(cypher);
    const { klass, detail } = classify(ref, cand, write, cypher);
    this.entries.push({
      project: this.project, phase: this.phase, label: write ? 'ingest' : '?', cypher, write, klass,
      refRows: ref.success ? ref.data.records.length : -1, candRows: cand.success ? cand.data.records.length : -1,
      refMs: t1 - t0, candMs: t2 - t1, ...(detail !== undefined ? { detail } : {}),
    });
    return ref;
  }

  async clearGraph(): Promise<DomainResult<void>> {
    const r = await this.executeQuery('MATCH (n) DETACH DELETE n');
    return r.success ? DomainResult.ok(undefined) : DomainResult.fail(r.errors);
  }

  async healthCheck(): Promise<boolean> {
    return (await this.reference.healthCheck()) && (await this.candidate.healthCheck());
  }

  async close(): Promise<void> {
    // The harness owns both repositories and closes them once, at the end.
  }
}

/** The four texts the compiler can emit for a template: exclude marker off/on × v1.2E text / v1.3 rewrites. */
export function sweepTexts(t: CypherTemplate): { readonly variant: string; readonly text: string; readonly excludes: boolean }[] {
  const out: { variant: string; text: string; excludes: boolean }[] = [];
  for (const excludes of [false, true]) {
    const base = replaceExcludeMarkers(t.template, excludes);
    out.push({ variant: `v1.2e${excludes ? '+exclude' : ''}`, text: base, excludes });
    const v13 = applyV13Rewrites(t.functionName, base, { edgeViews: true, roleTokens: true });
    if (v13 !== base) out.push({ variant: `v1.3${excludes ? '+exclude' : ''}`, text: v13, excludes });
  }
  return out;
}

/** `$name`s a query text reads. */
export function paramNames(text: string): string[] {
  return [...new Set([...text.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1] as string))];
}
