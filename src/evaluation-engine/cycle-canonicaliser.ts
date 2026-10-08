/**
 * Cycle sentinel and defensive canonicaliser for `no-cyclic-deps` rows (C6; FR-35;
 * U3 BR-U3-08, BR-U3-09).
 *
 * Order of use (wired by U3-R3): `applyCycleCap` decides `truncated` on the **raw** rows, then
 * `dedupeCycleRecords` canonicalises and de-duplicates the kept rows before mapping. On U1's
 * canonical rows (smallest file first, closed `[a, …, a]`, one row per cycle) both are no-ops.
 */
import { CYCLE_ROW_CAP } from '../fitness-compiler/cypher-templates.js';

export interface CycleCapResult<R> {
  readonly kept: readonly R[];
  readonly truncated: boolean;
}

/**
 * Keeps the first `cap` raw rows. `truncated` is decided on the raw count (more than `cap` rows,
 * i.e. the template's sentinel row is present), before any de-duplication can hide it (BR-U3-08).
 */
export function applyCycleCap<R>(records: readonly R[], cap: number = CYCLE_ROW_CAP): CycleCapResult<R> {
  return records.length > cap
    ? { kept: records.slice(0, cap), truncated: true }
    : { kept: records, truncated: false };
}

/**
 * Rotates a cycle to start at its smallest member (string order). A closed cycle `[a, …, a]` is
 * re-closed; an open ring `[a, b, c]` stays open. Lists shorter than two members are returned as
 * they are.
 */
export function canonicaliseCycle(cycle: readonly string[]): readonly string[] {
  const first = cycle[0];
  const closed = cycle.length >= 2 && first !== undefined && first === cycle[cycle.length - 1];
  const ring = closed ? cycle.slice(0, -1) : [...cycle];
  if (ring.length < 2) return cycle;
  let start = 0;
  ring.forEach((member, i) => {
    if (member < (ring[start] ?? member)) start = i;
  });
  if (start === 0) return cycle;
  const rotated = [...ring.slice(start), ...ring.slice(0, start)];
  return closed ? [...rotated, ...rotated.slice(0, 1)] : rotated;
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Canonicalises the cycle column of each row and drops rows whose canonical cycle was already
 * seen (first occurrence kept, order preserved; BR-U3-09). A row whose cycle had to be rotated
 * also gets `target` = the new second member (the `no-cyclic-deps` target is `cycle[1]`) when
 * its old target was the old second member, and `line` = `null` (the line belongs to the old
 * first edge). Rows whose cycle column is not a string list pass through unchanged.
 */
export function dedupeCycleRecords<R extends Readonly<Record<string, unknown>>>(
  records: readonly R[],
  cycleColumn = 'cycle',
): readonly R[] {
  const seen = new Set<string>();
  const out: R[] = [];
  for (const record of records) {
    const cycle = record[cycleColumn];
    if (!isStringList(cycle)) {
      out.push(record);
      continue;
    }
    const canonical = canonicaliseCycle(cycle);
    const key = JSON.stringify(canonical);
    if (seen.has(key)) continue;
    seen.add(key);
    if (canonical === cycle) {
      out.push(record);
      continue;
    }
    const rotated: Record<string, unknown> = { ...record, [cycleColumn]: canonical };
    if ('target' in record && record.target === cycle[1]) rotated.target = canonical[1];
    if ('line' in record) rotated.line = null;
    out.push(rotated as R);
  }
  return out;
}
