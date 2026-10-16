/**
 * Differential parity machinery for the in-process graph engines (Docs/v1.3/cypher-interpreter.md §4).
 *
 * - `ParityTee`: a `GraphRepository` that sends every statement to the reference (Neo4j) and to the candidate
 *   (the interpreter's `MemoryGraphRepository`), records both outcomes and returns the REFERENCE result, so the
 *   pipeline under test runs exactly as on Neo4j and the candidate is judged on every query the pipeline issues.
 * - `classify`: equal | order | float-drift | content | error | unsupported (| both-error) for one statement.
 * - `catalogueSweep`: every catalogue template, instantiated the four ways the compiler can emit it (exclude marker
 *   off/on × v1.2E text / v1.3 rewrites), with parameters bound from the project's spec, run through the tee.
 */
import neo4j from 'neo4j-driver';
import type { GraphRepository, QueryOptions, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import { replaceExcludeMarkers } from '../../../src/fitness-compiler/exclude-injector.js';
import { applyV13Rewrites } from '../../../src/fitness-compiler/v13-rewrites.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../../../src/scoring-engine/universal-metrics.js';

/**
 * - `equal`: same columns, same values (INTEGER and FLOAT kept apart), same row order.
 * - `order`: the same multiset of rows in a different order (genuine row-order difference of a query without a
 *   complete ORDER BY; trap T1). Values are bit-identical.
 * - `float-drift`: same rows in the same order, every value bit-identical except FLOATs that differ by at most
 *   `FLOAT_DRIFT_MAX_ULPS` units in the last place, and ONLY for a text in `FLOAT_DRIFT_TEMPLATES` (trap T2). Both
 *   values of every drifting cell are recorded (`ParityEntry.floatDrift`).
 * - `content`: anything else with both sides successful. `error` / `unsupported` / `both-error`: failures.
 */
export type ParityClass = 'equal' | 'order' | 'float-drift' | 'content' | 'error' | 'unsupported' | 'both-error';

/**
 * The ULP bound of `float-drift` (trap T2). Measured, not guessed (`scripts/v1.3/cypher-interp-avg-order.ts`,
 * `results/v1.3-cypher-interp/parity/avg-order-spread.json`): the incremental mean of one project's 30 instability
 * values spans -2..+8 ULP around the interpreter's answer over 300,000 seeded random row orders (-3..+9 in an
 * unseeded run), and every answer Neo4j gave for that graph (0, +3, +4, +5 ULP on different ingestions) is the fold
 * of its own row order. The largest drift in the parity run is 5 ULP. 16 covers the measured spread with margin while
 * staying ~3.6e-15 relative for values in [0.25, 0.5).
 * (Until this fix the rule was `|a - b| <= 4 * Number.EPSILON * max(|a|, |b|)`, documented as "4 ULP" but up to 8 ULP
 * for values in [0.25, 0.5), and it applied to any text containing `avg(` or `sum(`.)
 */
export const FLOAT_DRIFT_MAX_ULPS = 16;

/**
 * The only query texts the float tolerance applies to, by exact text: the two `averageInstability` metrics, whose
 * `avg` runs over rows in Neo4j's unspecified MATCH order. Any other text (a future `avg`/`sum` template included)
 * is compared bit for bit: a last-bit difference there is `content` until it is named here, with its reason.
 */
export const FLOAT_DRIFT_TEMPLATES: ReadonlyMap<string, string> = new Map([
  [UNIVERSAL_METRIC_QUERIES.averageInstability, 'universal:averageInstability'],
  [UNIVERSAL_METRIC_QUERIES_LITERAL.averageInstability, 'universal-literal:averageInstability'],
]);

/** One FLOAT cell that differs between the engines within the ULP bound: both values, exactly as each engine returned them. */
export interface FloatDriftCell {
  readonly row: number;
  readonly column: string;
  readonly neo4j: string;
  readonly interp: string;
  readonly ulps: number;
}

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
  /** For `float-drift`: every drifting cell, with both values. */
  readonly floatDrift?: readonly FloatDriftCell[];
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

export interface Classification {
  readonly klass: ParityClass;
  readonly detail?: string;
  readonly floatDrift?: readonly FloatDriftCell[];
}

export function classify(ref: DomainResult<QueryResult>, cand: DomainResult<QueryResult>, write: boolean, cypher = ''): Classification {
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
  // Trap T2, for the named texts only: same rows, same order, FLOATs within the ULP bound.
  if (FLOAT_DRIFT_TEMPLATES.has(cypher)) {
    const cells = floatDriftCells(ref.data, cand.data);
    if (cells !== undefined) {
      const worst = Math.max(...cells.map((c) => c.ulps));
      return { klass: 'float-drift', detail: `${FLOAT_DRIFT_TEMPLATES.get(cypher) ?? ''}: ${String(cells.length)} cell(s), max ${String(worst)} ULP (bound ${String(FLOAT_DRIFT_MAX_ULPS)})`, floatDrift: cells };
    }
  }
  const onlyRef = sa.filter((x) => !sb.includes(x)).slice(0, 3);
  const onlyCand = sb.filter((x) => !sa.includes(x)).slice(0, 3);
  return { klass: 'content', detail: `rows ${String(a.length)} vs ${String(b.length)}; only neo4j: ${onlyRef.join(' ')}; only interp: ${onlyCand.join(' ')}`.slice(0, 2000) };
}

/** Distance in units in the last place between two finite doubles of the same sign (Infinity otherwise). */
export function ulpDistance(x: number, y: number): number {
  if (Object.is(x, y)) return 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.sign(x) !== Math.sign(y)) return Infinity;
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, x);
  buf.setFloat64(8, y);
  const d = buf.getBigInt64(0) - buf.getBigInt64(8);
  return Number(d < 0n ? -d : d);
}

/**
 * The drifting FLOAT cells when the two results have the same columns, rows and order, every non-FLOAT value
 * identical and every FLOAT within `FLOAT_DRIFT_MAX_ULPS`; `undefined` when they differ in any other way.
 */
export function floatDriftCells(a: QueryResult, b: QueryResult): FloatDriftCell[] | undefined {
  if (a.records.length !== b.records.length) return undefined;
  const cells: FloatDriftCell[] = [];
  for (let i = 0; i < a.records.length; i++) {
    const ra = a.records[i] as Record<string, unknown>;
    const rb = b.records[i] as Record<string, unknown>;
    const ka = Object.keys(ra);
    if (ka.length !== Object.keys(rb).length || !ka.every((k, j) => k === Object.keys(rb)[j])) return undefined;
    for (const k of ka) {
      const x = ra[k];
      const y = rb[k];
      if (typeof x === 'number' && typeof y === 'number') {
        const ulps = ulpDistance(x, y);
        if (ulps > FLOAT_DRIFT_MAX_ULPS) return undefined;
        if (ulps > 0) cells.push({ row: i, column: k, neo4j: String(x), interp: String(y), ulps });
      } else if (JSON.stringify(canon(x)) !== JSON.stringify(canon(y))) {
        return undefined;
      }
    }
  }
  return cells.length > 0 ? cells : undefined;
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
    const { klass, detail, floatDrift } = classify(ref, cand, write, cypher);
    this.entries.push({
      project: this.project, phase: this.phase, label: write ? 'ingest' : '?', cypher, write, klass,
      refRows: ref.success ? ref.data.records.length : -1, candRows: cand.success ? cand.data.records.length : -1,
      refMs: t1 - t0, candMs: t2 - t1, ...(detail !== undefined ? { detail } : {}), ...(floatDrift !== undefined ? { floatDrift } : {}),
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
