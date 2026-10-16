/**
 * The fuzz harness's verdict on one statement run on both engines (Docs/v1.3/cypher-interp-fuzz.md §3).
 *
 * Starts from the parity classes (`classify` in memory-sweep.ts) and refines every class that is not `equal`:
 * - `ok`: equal, or both failed with the same Neo4j status code;
 * - `quirk:<id>`: a difference the interpreter documents as Neo4j-unspecified (row order without ORDER BY, T1; order
 *   among rows tied on every ORDER BY key, T8; which tied rows survive a LIMIT, T8; float accumulation order, T2; a
 *   data error Neo4j's plan reached and the interpreter's did not, T20: `strictCode` is the interpreter's error code
 *   for the statement in strict mode, `evalDiagnostics.strict`);
 * - `timeout`: Neo4j hit the per-statement timeout (an enumeration too large to compare; not a verdict);
 * - `mismatch:<kind>`: anything else (content, order outside ties, an error on one side, a different error code,
 *   `unsupported`). Every mismatch is minimised and classified by hand.
 */
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import { parseCypher } from '../../../src/cypher-interp/parse.js';
import type { Expr, Projection } from '../../../src/cypher-interp/ast.js';
import { canon, classify } from './memory-sweep.js';

export type Verdict = 'ok' | `quirk:${string}` | 'timeout' | `mismatch:${string}`;

const TIMEOUT_RE = /TransactionTimedOut|Transaction\.TransactionTimedOut|timed out|terminated/i;

export function errCode(r: DomainResult<QueryResult>): string {
  return r.success ? '' : (r.errors[0]?.code ?? '');
}

export function verdictOf(text: string, ref: DomainResult<QueryResult>, cand: DomainResult<QueryResult>, strictCode?: string): { verdict: Verdict; detail?: string } {
  if (!ref.success && ref.errors.some((e) => TIMEOUT_RE.test(e.code) || TIMEOUT_RE.test(e.message))) return { verdict: 'timeout' };
  const { klass, detail } = classify(ref, cand, false, text);
  switch (klass) {
    case 'equal':
      return { verdict: 'ok' };
    case 'both-error':
      return errCode(ref) === errCode(cand) ? { verdict: 'ok' } : { verdict: 'mismatch:error-code', ...(detail !== undefined ? { detail } : {}) };
    case 'error':
      // Trap T20: Neo4j raised a data error the interpreter did not, and the interpreter in strict mode (every
      // predicate over every candidate, errors raised eagerly) raises the same code: the error is reachable in some
      // evaluation order, and whether Neo4j reaches it depends on its plan (which end it expands from, which conjunct
      // it tests first, which path an EXISTS finds first).
      if (!ref.success && cand.success && strictCode !== undefined && strictCode === errCode(ref)) return { verdict: 'quirk:T20-plan-order-error', ...(detail !== undefined ? { detail } : {}) };
      return { verdict: 'mismatch:error', ...(detail !== undefined ? { detail } : {}) };
    case 'unsupported':
      return { verdict: `mismatch:${klass}`, ...(detail !== undefined ? { detail } : {}) };
    case 'order':
    case 'content': {
      if (detail === 'float accumulation order (<= 4 ULP)') return { verdict: 'quirk:T2-float-order', detail };
      if (!ref.success || !cand.success) return { verdict: `mismatch:${klass}` };
      const proj = finalProjection(text);
      if (proj === undefined || proj.orderBy.length === 0) {
        return klass === 'order' ? { verdict: 'quirk:T1-no-order-by' } : { verdict: 'mismatch:content', ...(detail !== undefined ? { detail } : {}) };
      }
      const keyCols = orderKeyColumns(proj);
      if (keyCols === undefined) return { verdict: `mismatch:${klass}`, detail: `ORDER BY keys are not returned columns; ${detail ?? ''}` };
      const limit = proj.limit?.k === 'lit' && typeof proj.limit.v === 'bigint' ? Number(proj.limit.v) : undefined;
      const tie = tieConsistent(ref.data, cand.data, keyCols, limit !== undefined && ref.data.records.length === limit);
      if (tie !== undefined) return { verdict: tie };
      return { verdict: klass === 'order' ? 'mismatch:order' : 'mismatch:content', ...(detail !== undefined ? { detail } : {}) };
    }
    default:
      return { verdict: `mismatch:${klass}` };
  }
}

function finalProjection(text: string): Projection | undefined {
  try {
    const q = parseCypher(text);
    const last = q.clauses[q.clauses.length - 1];
    return last?.k === 'return' ? last.projection : undefined;
  } catch {
    return undefined;
  }
}

/** The returned columns the ORDER BY sorts on, when every sort key is one (an alias, or an item's own expression). */
function orderKeyColumns(p: Projection): string[] | undefined {
  const cols: string[] = [];
  for (const s of p.orderBy) {
    const byAlias = s.expr.k === 'var' ? p.items.find((i) => i.alias === (s.expr as Extract<Expr, { k: 'var' }>).name) : undefined;
    const byExpr = byAlias ?? p.items.find((i) => JSON.stringify(i.expr, big) === JSON.stringify(s.expr, big));
    if (byExpr === undefined) return undefined;
    cols.push(byExpr.alias);
  }
  return cols;
}

function big(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? `${v.toString()}n` : v;
}

/**
 * Same sequence of sort keys on both sides and, within each run of rows tied on every key, the same multiset of rows:
 * the engines differ only where Neo4j leaves the order unspecified (T8). When a literal LIMIT cut the result, the last tie group
 * may hold different rows (which tied rows survive the cut is unspecified too), as long as it has the same key and size.
 */
function tieConsistent(a: QueryResult, b: QueryResult, keyCols: readonly string[], cut: boolean): Verdict | undefined {
  if (a.records.length !== b.records.length) return undefined;
  const key = (r: Record<string, unknown>): string => JSON.stringify(keyCols.map((c) => canon(r[c])));
  const row = (r: Record<string, unknown>): string => JSON.stringify(Object.entries(r).map(([k, x]) => [k, canon(x)]));
  const ka = a.records.map(key);
  const kb = b.records.map(key);
  if (ka.some((k, i) => k !== kb[i])) return undefined;
  let cutGroupDiffers = false;
  for (let i = 0; i < ka.length;) {
    let j = i;
    while (j < ka.length && ka[j] === ka[i]) j++;
    const ga = a.records.slice(i, j).map(row).sort();
    const gb = b.records.slice(i, j).map(row).sort();
    if (ga.some((x, n) => x !== gb[n])) {
      if (!(cut && j === ka.length)) return undefined;
      cutGroupDiffers = true;
    }
    i = j;
  }
  return cutGroupDiffers ? 'quirk:T8-limit-tie' : 'quirk:T8-order-by-tie';
}

export function isMismatch(v: Verdict): boolean {
  return v.startsWith('mismatch:');
}
