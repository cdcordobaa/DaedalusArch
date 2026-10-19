/**
 * MEAN-01 meaning analysis: meaningful precision (design BR-20 to BR-29, BR-08; codebook §8, §9.2, §9.5, §9.7).
 *
 * Every variant is a success function over the sample items: `true` (yes), `false` (no or unsure) or `null` (not
 * counted: blank, or dropped by the sensitivity). Dropped items stay in the item set as `null`, so a stratum that loses
 * all its items is left out and named, and the bootstrap resamples the same cells for every variant.
 */
import { MIN_INTERVAL_N, kishEffectiveN, wilson } from '../../../lib/stats.js';
import { stratifiedClusterBootstrap } from './bootstrap.js';
import { cmp, singleClusterStrata } from './load.js';
import type { AnalysisConfig, Answer, Counts4, Field, PrecisionBlock, PrecisionRow, ReadingKey, Role, RuleRow, Sample, SampleItem, Sheet } from './types.js';
import { EPS, answerOf } from './types.js';

export interface Unit {
  readonly item: SampleItem;
  readonly success: boolean | null;
}

export interface StratifiedShare {
  readonly estimate: number | null;
  readonly n: number;
  readonly yes: number;
  /** N': Σ N_h over the strata with at least one counted item. */
  readonly frameUsed: number;
  /** Strata present in the units with no counted item, sorted. */
  readonly emptyStrata: readonly string[];
}

/** BR-22: p̂ = Σ_h (N_h / N') p̂_h over the strata with at least one counted item. */
export function stratifiedShare(units: readonly Unit[]): StratifiedShare {
  const strata = new Map<string, { Nh: number; yes: number; m: number }>();
  let n = 0;
  let yes = 0;
  for (const u of units) {
    const s = strata.get(u.item.stratum) ?? { Nh: u.item.Nh, yes: 0, m: 0 };
    if (u.success !== null) {
      s.m += 1;
      n += 1;
      if (u.success) { s.yes += 1; yes += 1; }
    }
    strata.set(u.item.stratum, s);
  }
  let frameUsed = 0;
  let acc = 0;
  const emptyStrata: string[] = [];
  for (const name of [...strata.keys()].sort(cmp)) {
    const s = strata.get(name);
    if (s === undefined) continue;
    if (s.m === 0) { emptyStrata.push(name); continue; }
    frameUsed += s.Nh;
    acc += s.Nh * (s.yes / s.m);
  }
  return { estimate: frameUsed === 0 ? null : acc / frameUsed, n, yes, frameUsed, emptyStrata };
}

const READING_TEXT: Record<ReadingKey, string> = {
  meaningful: 'blocking findings on human code mostly mark a change a practitioner would ask for',
  rival: 'the rival reading is supported',
  mixed: 'mixed; read per rule',
  'not-applicable': 'not applicable: no answered items',
};

/** BR-28: the §9.5 reading guide on p̂ and its bootstrap lower bound, with the 1e-9 tolerance. */
export function readingGuide(p: number | null, low: number | null): ReadingKey {
  if (p === null || low === null) return 'not-applicable';
  if (p >= 0.75 - EPS && low >= 0.5 - EPS) return 'meaningful';
  if (p <= 0.5 + EPS) return 'rival';
  return 'mixed';
}

export const readingText = (key: ReadingKey, singleRater: boolean): string =>
  `${singleRater ? 'descriptive only: ' : ''}${READING_TEXT[key]}`;

type SuccessFn = (item: SampleItem) => boolean | null;

function row(label: string, sample: Sample, success: SuccessFn, config: AnalysisConfig): PrecisionRow {
  const units: Unit[] = sample.items.map((item) => ({ item, success: success(item) }));
  const share = stratifiedShare(units);
  const interval = stratifiedClusterBootstrap(units, (u) => u.item, (s) => {
    const r = stratifiedShare(s);
    return { value: r.estimate, emptyStratum: r.emptyStrata.length > 0 };
  }, { seed: config.seed, resamples: config.resamples });
  return { label, n: share.n, yes: share.yes, estimate: share.estimate, frameUsed: share.frameUsed, emptyStrata: share.emptyStrata, interval };
}

const yesOrNull = (v: Answer | null): boolean | null => (v === null ? null : v === 'yes');

function counts(values: readonly (Answer | null)[]): Counts4 {
  const c = { yes: 0, no: 0, unsure: 0, blank: 0 };
  for (const v of values) c[v ?? 'blank'] += 1;
  return c;
}

export interface PrecisionSheets {
  readonly rater: Sheet | null;
  readonly author: Sheet | null;
}

/**
 * BR-20 to BR-29: the precision block on `field`. The reference is the rater (BR-20); with only the author's sheet
 * (single-rater mode, BR-08) it is the author, and the two-rater sensitivities are listed as not applicable.
 */
export function precision(sample: Sample, sheets: PrecisionSheets, field: Field, config: AnalysisConfig): PrecisionBlock {
  const refSheet = sheets.rater ?? sheets.author;
  if (refSheet === null) throw new Error('precision: needs at least one sheet');
  const reference: Role = refSheet.role;
  const ans = (s: Sheet, it: SampleItem): Answer | null => answerOf(s.rows.get(it.itemId), field);
  const ref = (it: SampleItem): Answer | null => ans(refSheet, it);
  const headline = row(`headline (${reference}, ${field})`, sample, (it) => yesOrNull(ref(it)), config);

  const answered = sample.items.filter((it) => ref(it) !== null);
  const yes = answered.filter((it) => ref(it) === 'yes').length;
  const unweighted = answered.length === 0
    ? { share: null, wilson: null }
    : { share: yes / answered.length, wilson: wilson(yes, answered.length) };
  // BR-24: the weight the estimator applies to an answered item, N_h / m_h.
  const m = new Map<string, number>();
  for (const it of answered) m.set(it.stratum, (m.get(it.stratum) ?? 0) + 1);
  const kishN = answered.length === 0 ? null : kishEffectiveN(answered.map((it) => it.Nh / (m.get(it.stratum) ?? 1)));

  const sensitivities: PrecisionRow[] = [];
  const notApplicable: string[] = [];
  const { rater, author } = sheets;
  if (rater !== null && author !== null) {
    sensitivities.push(row("author's labels", sample, (it) => yesOrNull(ans(author, it)), config));
    sensitivities.push(row('yes by both raters', sample, (it) => {
      const r = ans(rater, it);
      const a = ans(author, it);
      return r === null || a === null ? null : r === 'yes' && a === 'yes';
    }, config));
  } else {
    notApplicable.push("author's labels", 'yes by both raters');
  }
  sensitivities.push(row(`${reference}'s unsure dropped`, sample, (it) => {
    const r = ref(it);
    return r === null || r === 'unsure' ? null : r === 'yes';
  }, config));
  sensitivities.push(row('testOrMock items dropped', sample, (it) => (it.testOrMock ? null : yesOrNull(ref(it))), config));
  sensitivities.push(row(`items the ${reference} coded M dropped`, sample, (it) => (refSheet.rows.get(it.itemId)?.whyNot === 'M' ? null : yesOrNull(ref(it))), config));

  const rules = new Map<string, SampleItem[]>();
  for (const it of sample.items) rules.set(it.ruleId, [...(rules.get(it.ruleId) ?? []), it]);
  const perRule: RuleRow[] = [...rules.keys()].sort(cmp).map((ruleId) => {
    const c = counts((rules.get(ruleId) ?? []).map(ref));
    const n = c.yes + c.no + c.unsure;
    const big = n >= MIN_INTERVAL_N;
    return { ruleId, ...c, n, share: big ? c.yes / n : null, wilson: big ? wilson(c.yes, n) : null };
  });
  const styles = new Map<string, SampleItem[]>();
  for (const it of sample.items) styles.set(it.style, [...(styles.get(it.style) ?? []), it]);
  const perStyle = [...styles.keys()].sort(cmp).map((style) => ({ style, ...counts((styles.get(style) ?? []).map(ref)) }));

  const reading = readingGuide(headline.estimate, headline.interval.low);
  const singleRater = rater === null || author === null;
  return {
    field, reference, blank: sample.items.filter((it) => ref(it) === null).map((it) => it.itemId), headline, unweighted, kishN, singleClusterStrata: singleClusterStrata(sample.items),
    sensitivities, notApplicable, perRule, perStyle, reading, readingText: readingText(reading, singleRater),
  };
}
