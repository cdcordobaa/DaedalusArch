/**
 * Evidence grammar and id merge (C6, FR-12; U3 domain-entities.md §1.2; BR-U3-07).
 *
 *   entry  := column "=" value
 *   value  := number | "null" | rawString
 *   number := String(Number(x))   (ECMAScript shortest round-trip form, never rounded)
 *
 * Measured values live here and never in the violation id (BR-U3-06). The encoding and the
 * merge rule are frozen before the first run (BR-U3-70 items 5 and 6).
 */
import type { Violation } from '../shared/taxonomy/violation-types.js';
import { scalarText, toFiniteNumber } from './violation-id.js';

export type EvidenceValue = number | string | null;

const NUMBER_SHAPE = /^-?(\d+(\.\d+)?([eE][+-]?\d+)?|Infinity)$/;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  const n = toFiniteNumber(value);
  if (n !== undefined) return String(n);
  if (Array.isArray(value)) return JSON.stringify(value);
  return scalarText(value); // strings raw; NaN / ±Infinity as written by String()
}

/** One entry per evidence column, in declaration order, and nothing else. */
export function formatEvidence(
  row: Readonly<Record<string, unknown>>,
  columns: readonly string[],
): readonly string[] {
  return columns.map((column) => `${column}=${formatValue(row[column])}`);
}

/** Parses one value written by `formatEvidence`. */
export function parseEvidenceValue(text: string): EvidenceValue {
  if (text === 'null') return null;
  if (NUMBER_SHAPE.test(text) && String(Number(text)) === text) return Number(text);
  return text;
}

/** Splits every entry at its first `=`; the right side is parsed with `parseEvidenceValue`. */
export function parseEvidence(entries: readonly string[]): Readonly<Record<string, EvidenceValue>> {
  const out: Record<string, EvidenceValue> = {};
  for (const entry of entries) {
    const at = entry.indexOf('=');
    if (at === -1) {
      out[entry] = null;
      continue;
    }
    out[entry.slice(0, at)] = parseEvidenceValue(entry.slice(at + 1));
  }
  return out;
}

/**
 * Merges violations of one function that share an id (BR-U3-07). The first violation of an id
 * (the template's `ORDER BY` order) keeps every identity field and its position; each evidence
 * column takes the maximum numeric value over the merged violations (non-numeric: the first
 * violation's value). Violations without a duplicate are returned as they are.
 */
export function mergeById(violations: readonly Violation[]): readonly Violation[] {
  const groups = new Map<string, { first: Violation; rest: Violation[] }>();
  for (const violation of violations) {
    const group = groups.get(violation.id);
    if (group === undefined) {
      groups.set(violation.id, { first: violation, rest: [] });
    } else {
      group.rest.push(violation);
    }
  }
  // Map iteration follows insertion order, i.e. the first occurrence of each id.
  return [...groups.values()].map(({ first, rest }) => (rest.length === 0 ? first : mergeGroup(first, rest)));
}

function mergeGroup(first: Violation, rest: readonly Violation[]): Violation {
  if (first.evidence === undefined) return first;
  const parsed = rest.map((v) => parseEvidence(v.evidence ?? []));
  const evidence = first.evidence.map((entry) => {
    const at = entry.indexOf('=');
    if (at === -1) return entry;
    const column = entry.slice(0, at);
    let best = parseEvidenceValue(entry.slice(at + 1));
    if (typeof best !== 'number') return entry;
    for (const values of parsed) {
      const candidate = values[column];
      if (typeof candidate === 'number' && candidate > best) best = candidate;
    }
    return `${column}=${String(best)}`;
  });
  return { ...first, evidence };
}
