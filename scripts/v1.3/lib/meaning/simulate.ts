/**
 * MEAN-01 meaning analysis: synthetic answer sheets for tests and the author's dry run (design BR-60).
 *
 * Simulation has no notion of the primary field (L4 is open): `tableA` sets the A_practitioner 2×2 and `tableB` the
 * B_style_fidelity 2×2, each as (a both yes, b rater yes / author not, c rater not / author yes, d both not). The rater
 * column is `simulated`, which marks any run on these sheets SYNTHETIC (BR-05, BR-52).
 */
import { createRng, shuffle } from '../../../lib/stats.js';
import { SHEET_HEADER } from './load.js';
import type { Answer, Sample } from './types.js';

export type Table4 = readonly [number, number, number, number];

export interface SimulateOptions {
  readonly tableA: Table4;
  readonly tableB?: Table4;
  /** Turns `no` into `unsure` on k of the rater's not-yes items, in both fields. */
  readonly unsureRater?: number;
  /** Blanks both fields of k items in the author's sheet. */
  readonly blank?: number;
  readonly seed: number;
}

export class SimulateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulateError';
  }
}

export function parseTable(text: string, flag: string): Table4 {
  const parts = text.split(',').map((s) => s.trim());
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) throw new SimulateError(`${flag}: expected four non-negative integers a,b,c,d, got "${text}"`);
  return parts.map(Number) as unknown as Table4;
}

interface Cell { r: Answer | null; a: Answer | null }

export function simulateSheets(sample: Sample, opts: SimulateOptions): { author: string; rater: string } {
  const ids = sample.items.map((x) => x.itemId);
  const blank = opts.blank ?? 0;
  const unsureK = opts.unsureRater ?? 0;
  const tableB = opts.tableB ?? opts.tableA;
  if (!Number.isInteger(blank) || blank < 0 || blank > ids.length) throw new SimulateError(`--blank must be an integer in [0, ${ids.length}]`);
  if (!Number.isInteger(unsureK) || unsureK < 0) throw new SimulateError('--unsure-rater must be a non-negative integer');
  const target = ids.length - blank;
  for (const [name, t] of [['--table-a', opts.tableA], ['--table-b', tableB]] as const) {
    const sum = t.reduce((s, x) => s + x, 0);
    if (sum !== target) throw new SimulateError(`${name}: a + b + c + d = ${sum}, but the sample has ${ids.length} items minus ${blank} blank = ${target}`);
  }
  const rng = createRng(opts.seed);
  const blankIds = new Set(shuffle(ids, rng).slice(0, blank));
  const rest = ids.filter((id) => !blankIds.has(id));
  const fill = (t: Table4): Map<string, Cell> => {
    const order = shuffle(rest, rng);
    const kinds: Cell[] = [
      ...Array.from({ length: t[0] }, () => ({ r: 'yes' as Answer, a: 'yes' as Answer })),
      ...Array.from({ length: t[1] }, () => ({ r: 'yes' as Answer, a: 'no' as Answer })),
      ...Array.from({ length: t[2] }, () => ({ r: 'no' as Answer, a: 'yes' as Answer })),
      ...Array.from({ length: t[3] }, () => ({ r: 'no' as Answer, a: 'no' as Answer })),
    ];
    const m = new Map<string, Cell>(order.map((id, i) => [id, { ...(kinds[i] ?? { r: null, a: null }) }]));
    for (const id of blankIds) m.set(id, { r: 'no', a: null });
    return m;
  };
  const A = fill(opts.tableA);
  const B = fill(tableB);
  for (const [name, m] of [['A', A], ['B', B]] as const) {
    if (unsureK === 0) continue;
    const notYes = [...m.entries()].filter(([, c]) => c.r === 'no').map(([id]) => id).sort();
    if (notYes.length < unsureK) throw new SimulateError(`--unsure-rater ${unsureK}: field ${name} has only ${notYes.length} rater not-yes items`);
    for (const id of shuffle(notYes, rng).slice(0, unsureK)) {
      const c = m.get(id);
      if (c !== undefined) c.r = 'unsure';
    }
  }
  const csv = (pick: (c: Cell) => Answer | null): string =>
    [SHEET_HEADER.join(','), ...ids.map((id) => `${id},simulated,${pick(A.get(id) ?? { r: null, a: null }) ?? ''},${pick(B.get(id) ?? { r: null, a: null }) ?? ''},,`)].join('\n') + '\n';
  return { rater: csv((c) => c.r), author: csv((c) => c.a) };
}
