/**
 * Cycle sentinel before de-duplication (FR-35; U3 BR-U3-08, BR-U3-09; TF-15, TF-26).
 */
import {
  applyCycleCap, canonicaliseCycle, dedupeCycleRecords,
} from '../../../src/evaluation-engine/cycle-canonicaliser.js';
import { CYCLE_ROW_CAP } from '../../../src/fitness-compiler/cypher-templates.js';

interface CycleRow extends Record<string, unknown> {
  readonly cycle: readonly string[];
  readonly target: string;
  readonly line: number | null;
}

/** U1-shaped canonical row: smallest file first, closed, target = cycle[1]. */
function u1Row(i: number): CycleRow {
  const a = `src/m${String(i).padStart(3, '0')}/a.ts`;
  const b = `src/m${String(i).padStart(3, '0')}/b.ts`;
  return { cycle: [a, b, a], target: b, line: 1 };
}

function rows(n: number): CycleRow[] {
  return Array.from({ length: n }, (_, i) => u1Row(i));
}

/** The same cycle as `row`, rotated to start at its second member. */
function rotated(row: CycleRow): CycleRow {
  const [a, b] = row.cycle;
  if (a === undefined || b === undefined) throw new Error('short cycle');
  return { cycle: [b, a, b], target: a, line: 7 };
}

describe('applyCycleCap (BR-U3-08)', () => {
  it('uses the U1 cap of 100', () => {
    expect(CYCLE_ROW_CAP).toBe(100);
  });

  it('TF-15: 101 raw rows keep 100 and are truncated', () => {
    const result = applyCycleCap(rows(101));
    expect(result.kept).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it('100 raw rows are kept whole and not truncated', () => {
    const input = rows(100);
    const result = applyCycleCap(input);
    expect(result.kept).toHaveLength(100);
    expect(result.truncated).toBe(false);
  });

  it('TF-26: 101 raw rows of which two are rotated duplicates are still truncated (cap decided on the raw count)', () => {
    const base = rows(99);
    const first = base[0];
    const second = base[1];
    if (first === undefined || second === undefined) throw new Error('fixture');
    const raw = [...base, rotated(first), rotated(second)];
    expect(raw).toHaveLength(101);
    const { kept, truncated } = applyCycleCap(raw, CYCLE_ROW_CAP);
    expect(truncated).toBe(true);
    // Only after the decision does de-duplication run on the kept rows (one rotated duplicate is kept by the cap).
    expect(dedupeCycleRecords(kept)).toHaveLength(99);
  });
});

describe('canonicaliseCycle and dedupeCycleRecords (BR-U3-09)', () => {
  it('rotates closed and open cycles to the smallest member', () => {
    expect(canonicaliseCycle(['b', 'c', 'a', 'b'])).toEqual(['a', 'b', 'c', 'a']);
    expect(canonicaliseCycle(['c', 'a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'a']);
    expect(canonicaliseCycle(['b', 'c', 'a'])).toEqual(['a', 'b', 'c']);
    const canonical = ['a', 'c', 'b', 'a'];
    expect(canonicaliseCycle(canonical)).toBe(canonical);
    expect(canonicaliseCycle(['a'])).toEqual(['a']);
  });

  it('U1-shaped rows pass through unchanged (deep equality, same objects)', () => {
    const input = rows(5);
    const out = dedupeCycleRecords(input);
    expect(out).toEqual(input);
    out.forEach((row, i) => { expect(row).toBe(input[i]); });
  });

  it('a rotated duplicate is removed', () => {
    const row = u1Row(1);
    expect(dedupeCycleRecords([row, rotated(row)])).toEqual([row]);
  });

  it('a lone rotated row is rotated to the smallest file, target follows, line cleared', () => {
    const row = u1Row(2);
    const out = dedupeCycleRecords([rotated(row)]);
    expect(out).toEqual([{ cycle: row.cycle, target: row.target, line: null }]);
  });

  it('rows without a string-list cycle column pass through', () => {
    const odd = { cycle: 'a,b,a', target: 'b', line: 1 };
    expect(dedupeCycleRecords([odd])).toEqual([odd]);
  });
});
