/**
 * MEAN-01 meaning analysis: the κ block on one field (design BR-10 to BR-19; codebook §4, §9.1).
 *
 * Binary category: `yes` vs not-`yes` (`no` and `unsure` are not-yes). Unit: a sample item both raters answered on
 * the field. 2×2 rows are the rater, columns the author.
 */
import { cohenKappa, gwetAC1, wilson } from '../../../lib/stats.js';
import { itemBootstrap, stratifiedClusterBootstrap } from './bootstrap.js';
import { cmp } from './load.js';
import type { AgreementBlock, AnalysisConfig, Answer, Field, GateResult, Sample, SampleItem, Sheet, StyleCounts2x2, UnsureRate } from './types.js';
import { ANSWERS, EPS, answerOf } from './types.js';

export interface Pair {
  readonly item: SampleItem;
  readonly r: Answer;
  readonly a: Answer;
}

export interface Table2 { a: number; b: number; c: number; d: number }

export function table2(pairs: readonly Pair[]): Table2 {
  const t = { a: 0, b: 0, c: 0, d: 0 };
  for (const p of pairs) {
    const ry = p.r === 'yes';
    const ay = p.a === 'yes';
    if (ry && ay) t.a += 1; else if (ry) t.b += 1; else if (ay) t.c += 1; else t.d += 1;
  }
  return t;
}

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null);

/** BR-13: Cohen's κ on the 2×2; `null` (undefined) for n = 0 or p_e = 1 (0/0). */
export function kappa2(t: Table2): number | null {
  if (t.a + t.b + t.c + t.d === 0) return null;
  return finite(cohenKappa([[t.a, t.b], [t.c, t.d]]));
}

function table3(pairs: readonly Pair[]): number[][] {
  const t = ANSWERS.map(() => ANSWERS.map(() => 0));
  for (const p of pairs) {
    const row = t[ANSWERS.indexOf(p.r)];
    if (row !== undefined) row[ANSWERS.indexOf(p.a)] = (row[ANSWERS.indexOf(p.a)] ?? 0) + 1;
  }
  return t;
}

/** BR-14: κ ≥ gate − 1e-9. */
export const passesGate = (kappa: number | null, gate: number): boolean => kappa !== null && kappa >= gate - EPS;

function unsureRate(sheet: Sheet, sample: Sample, field: Field): UnsureRate {
  let unsure = 0;
  let answered = 0;
  for (const it of sample.items) {
    const v = answerOf(sheet.rows.get(it.itemId), field);
    if (v === null) continue;
    answered += 1;
    if (v === 'unsure') unsure += 1;
  }
  const rate = answered === 0 ? null : unsure / answered;
  return { unsure, answered, rate, flagged: rate !== null && rate > 0.15 };
}

export function agreement(sample: Sample, rater: Sheet, author: Sheet, field: Field, config: AnalysisConfig): AgreementBlock {
  const pairs: Pair[] = [];
  const dropped: string[] = [];
  for (const item of sample.items) {
    const r = answerOf(rater.rows.get(item.itemId), field);
    const a = answerOf(author.rows.get(item.itemId), field);
    if (r === null || a === null) dropped.push(item.itemId);
    else pairs.push({ item, r, a });
  }
  const n = pairs.length;
  const incomplete = n < config.minN;
  const t = table2(pairs);
  const kappa = kappa2(t);
  const result: GateResult = incomplete ? 'INCOMPLETE' : passesGate(kappa, config.gate) ? 'PASS' : 'FAIL';
  const unsure = { rater: unsureRate(rater, sample, field), author: unsureRate(author, sample, field) };
  const t3 = table3(pairs);
  const styles = new Map<string, Pair[]>();
  for (const p of pairs) styles.set(p.item.style, [...(styles.get(p.item.style) ?? []), p]);
  const byStyle: StyleCounts2x2[] = [...styles.keys()].sort(cmp).map((style) => {
    const ps = styles.get(style) ?? [];
    return { style, n: ps.length, ...table2(ps) };
  });
  const base = {
    field, gated: field === config.primary, n, dropped, incomplete, result, table: t, kappa, table3: t3, unsure, byStyle,
  };
  if (n === 0) {
    // BR-13: nothing is computed on an empty table (wilson and the bootstraps throw on n = 0).
    return {
      ...base, kappaItemInterval: null, kappaClusterInterval: null, observed: null, observedInterval: null, ac1: null,
      prevalenceIndex: null, biasIndex: null, pabak: null, kappa3: null, prevalenceNote: false,
      noUnsure: { n: 0, kappa: null },
    };
  }
  const kStat = (s: readonly Pair[]): { value: number | null } => ({ value: kappa2(table2(s)) });
  const opts = { seed: config.seed, resamples: config.resamples };
  const agree = t.a + t.d;
  const observed = agree / n;
  const ac1 = finite(gwetAC1([[t.a, t.b], [t.c, t.d]]));
  const prevalenceIndex = Math.abs(t.a - t.d) / n;
  const noUnsurePairs = pairs.filter((p) => p.r !== 'unsure' && p.a !== 'unsure');
  return {
    ...base,
    kappaItemInterval: itemBootstrap(pairs, kStat, opts),
    kappaClusterInterval: stratifiedClusterBootstrap(pairs, (p) => p.item, kStat, opts),
    observed,
    observedInterval: wilson(agree, n),
    ac1,
    prevalenceIndex,
    biasIndex: Math.abs(t.b - t.c) / n,
    pabak: 2 * observed - 1,
    kappa3: finite(cohenKappa(t3)),
    // BR-17: also when κ is undefined.
    prevalenceNote: !passesGate(kappa, config.gate) && ac1 !== null && ac1 >= config.gate - EPS && prevalenceIndex >= 0.5 - EPS,
    noUnsure: { n: noUnsurePairs.length, kappa: kappa2(table2(noUnsurePairs)) },
  };
}
