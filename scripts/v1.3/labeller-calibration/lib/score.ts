/**
 * v1.3 labeller calibration: scoring and the pre-registered decision rule (Docs/v1.3/labeller-calibration-plan.md §6).
 * The constants in `DECISION_RULE` are quoted in the plan; changing one is a dated amendment.
 *
 * Per dataset and per (rater, arm):
 * - **H–H**: Krippendorff's α (nominal, binary) over every pair of human ratings of the same item, plus the
 *   observed agreement and PABAK of those pairs. This is the human–human reference, computed on the same sampled
 *   items, so it is comparable to the model figure item for item.
 * - **M–H**: the same α over every (model, human) pair of the same item ("does the model agree with a human as well
 *   as two humans agree with each other": the replace-one-annotator view of Ahmed et al., MSR 2025).
 * - **Δ = α(M–H) − α(H–H)** with a seeded item bootstrap 95 % interval: the primary statistic.
 * - **vs consensus**: Cohen's κ, Gwet's AC1, PABAK and observed agreement (Wilson interval) of the model against the
 *   human majority (ties excluded), with sensitivity and specificity.
 * - **M–M**: Cohen's κ between the two raters on the same arm (the model–model predictor of Ahmed et al.).
 * Model labels that are invalid, a judge split (`warning`) or `uncertain` are missing in the primary analysis
 * (counted by cause); the sensitivity analysis maps them to `pass`. Two gates come before the decision: the procedure
 * must not fail on more than 10 % of items, and at least 70 % must carry a binary label.
 */
import { cohenKappa, createRng, gwetAC1, quantileSorted, wilson } from '../../../lib/stats.js';
import { krippendorffAlphaNominal } from '../../lib/panel/stats.js';
import type { Arm, Binary, CalibrationItem, DatasetId, RaterId, RaterLabel } from './types.js';

export const DECISION_RULE = Object.freeze({
  id: 'labeller-calibration-v1',
  /** Non-inferiority margin on Δ = α(M–H) − α(H–H). */
  margin: 0.1,
  /** Share of sampled items on which the procedure must not fail (judge invalid, labeller invalid run). */
  minValidShare: 0.9,
  /** Share of sampled items that must carry a binary label (not a failure, judge split or labeller `uncertain`). */
  minAnsweredShare: 0.7,
  /** Below this H–H α the human reference is weak: a SUPPORT is reported as SUPPORT (weak reference). */
  weakReferenceAlpha: 0.4,
  bootstrapResamples: 2000,
  bootstrapSeed: 20261016,
});

export type Decision = 'SUPPORT' | 'SUPPORT (weak reference)' | 'NOT SUPPORTED' | 'INCONCLUSIVE' | 'NO DECISION (invalid share)' | 'NO DECISION (abstention share)';

export interface PairStats {
  readonly pairs: number;
  readonly alpha: number | null;
  readonly observed: number | null;
  readonly pabak: number | null;
}

export interface ConsensusStats {
  readonly n: number;
  readonly table: readonly (readonly number[])[];
  readonly kappa: number | null;
  readonly ac1: number | null;
  readonly pabak: number | null;
  readonly observed: number | null;
  readonly observedLow: number | null;
  readonly observedHigh: number | null;
  readonly sensitivity: number | null;
  readonly specificity: number | null;
}

export interface RaterArmScore {
  readonly rater: RaterId;
  readonly arm: Arm;
  readonly items: number;
  /** Items with a binary label. */
  readonly valid: number;
  /** Items on which the procedure did not fail. */
  readonly validShare: number;
  readonly answeredShare: number;
  readonly missingByCause: Readonly<Record<string, number>>;
  readonly hh: PairStats;
  readonly mh: PairStats;
  readonly delta: number | null;
  readonly deltaLow: number | null;
  readonly deltaHigh: number | null;
  readonly consensus: ConsensusStats;
  readonly decision: Decision;
  /** Same statistics with missing model labels mapped to `pass`. */
  readonly sensitivity: { readonly mh: PairStats; readonly delta: number | null; readonly consensus: ConsensusStats };
}

export interface DatasetScore {
  readonly dataset: DatasetId;
  readonly items: number;
  readonly humanRatingsPerItem: { readonly min: number; readonly mean: number; readonly max: number };
  readonly consensusFailShare: number | null;
  readonly perRaterArm: readonly RaterArmScore[];
  readonly modelModel: readonly { readonly arm: Arm; readonly a: RaterId; readonly b: RaterId; readonly n: number; readonly kappa: number | null; readonly observed: number | null }[];
}

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null);

export function humanBinaries(item: CalibrationItem): Binary[] {
  return item.ratings.flatMap((r) => (r.binary === null ? [] : [r.binary]));
}

/** Majority of the human binary ratings; null on a tie or no rating. */
export function consensus(item: CalibrationItem): Binary | null {
  const b = humanBinaries(item);
  const f = b.filter((x) => x === 'fail').length;
  const p = b.length - f;
  return f === p ? null : f > p ? 'fail' : 'pass';
}

function pairsWithin(xs: readonly Binary[]): [Binary, Binary][] {
  const out: [Binary, Binary][] = [];
  for (let i = 0; i < xs.length; i += 1) for (let j = i + 1; j < xs.length; j += 1) out.push([xs[i] as Binary, xs[j] as Binary]);
  return out;
}

export function pairStats(pairs: readonly (readonly [Binary, Binary])[]): PairStats {
  if (pairs.length === 0) return { pairs: 0, alpha: null, observed: null, pabak: null };
  const agree = pairs.filter(([a, b]) => a === b).length;
  const po = agree / pairs.length;
  return { pairs: pairs.length, alpha: krippendorffAlphaNominal(pairs.map((p) => [...p])), observed: po, pabak: 2 * po - 1 };
}

export function hhPairs(items: readonly CalibrationItem[]): [Binary, Binary][] {
  return items.flatMap((i) => pairsWithin(humanBinaries(i)));
}

export function mhPairs(items: readonly CalibrationItem[], model: ReadonlyMap<string, Binary | null>): [Binary, Binary][] {
  return items.flatMap((i) => {
    const m = model.get(i.id);
    return m === null || m === undefined ? [] : humanBinaries(i).map((h): [Binary, Binary] => [m, h]);
  });
}

export function consensusStats(items: readonly CalibrationItem[], model: ReadonlyMap<string, Binary | null>): ConsensusStats {
  // Rows: human consensus (fail, pass); columns: model.
  const t = [[0, 0], [0, 0]];
  for (const i of items) {
    const c = consensus(i);
    const m = model.get(i.id);
    if (c === null || m === null || m === undefined) continue;
    const row = t[c === 'fail' ? 0 : 1] as number[];
    row[m === 'fail' ? 0 : 1] = (row[m === 'fail' ? 0 : 1] ?? 0) + 1;
  }
  const [[tp, fn], [fp, tn]] = t as [[number, number], [number, number]];
  const n = tp + fn + fp + tn;
  if (n === 0) return { n, table: t, kappa: null, ac1: null, pabak: null, observed: null, observedLow: null, observedHigh: null, sensitivity: null, specificity: null };
  const po = (tp + tn) / n;
  const ci = wilson(tp + tn, n);
  return {
    n, table: t, kappa: finite(cohenKappa(t)), ac1: finite(gwetAC1(t)), pabak: 2 * po - 1, observed: po,
    observedLow: ci.low, observedHigh: ci.high,
    sensitivity: tp + fn > 0 ? tp / (tp + fn) : null, specificity: fp + tn > 0 ? tn / (fp + tn) : null,
  };
}

function deltaOf(items: readonly CalibrationItem[], model: ReadonlyMap<string, Binary | null>): number | null {
  const a = pairStats(mhPairs(items, model)).alpha;
  const b = pairStats(hhPairs(items)).alpha;
  return a === null || b === null ? null : a - b;
}

/** Percentile item bootstrap of Δ (seeded; resamples where Δ is undefined are dropped and counted). */
export function bootstrapDelta(items: readonly CalibrationItem[], model: ReadonlyMap<string, Binary | null>, resamples = DECISION_RULE.bootstrapResamples, seed = DECISION_RULE.bootstrapSeed): { low: number | null; high: number | null; dropped: number } {
  const rng = createRng(seed);
  const ds: number[] = [];
  let dropped = 0;
  for (let b = 0; b < resamples; b += 1) {
    // A drawn item keeps its id, so a duplicate resolves to the same model label.
    const sample = Array.from({ length: items.length }, () => items[rng.int(items.length)] as CalibrationItem);
    const d = deltaOf(sample, model);
    if (d === null) dropped += 1;
    else ds.push(d);
  }
  if (ds.length === 0) return { low: null, high: null, dropped };
  ds.sort((x, y) => x - y);
  return { low: quantileSorted(ds, 0.025), high: quantileSorted(ds, 0.975), dropped };
}

export function decide(validShare: number, answeredShare: number, hhAlpha: number | null, delta: number | null, low: number | null, high: number | null): Decision {
  if (validShare < DECISION_RULE.minValidShare) return 'NO DECISION (invalid share)';
  if (answeredShare < DECISION_RULE.minAnsweredShare) return 'NO DECISION (abstention share)';
  if (delta === null || low === null || high === null || hhAlpha === null) return 'INCONCLUSIVE';
  if (low >= -DECISION_RULE.margin) return hhAlpha < DECISION_RULE.weakReferenceAlpha ? 'SUPPORT (weak reference)' : 'SUPPORT';
  if (high < -DECISION_RULE.margin) return 'NOT SUPPORTED';
  return 'INCONCLUSIVE';
}

export function scoreRaterArm(items: readonly CalibrationItem[], labels: readonly RaterLabel[], rater: RaterId, arm: Arm): RaterArmScore {
  const mine = labels.filter((l) => l.rater === rater && l.arm === arm);
  const byId = new Map(mine.map((l) => [l.itemId, l]));
  const model = new Map<string, Binary | null>(items.map((i) => [i.id, byId.get(i.id)?.binary ?? null]));
  const sensModel = new Map<string, Binary | null>(items.map((i) => [i.id, byId.get(i.id)?.binary ?? 'pass']));
  const missingByCause: Record<string, number> = {};
  for (const i of items) {
    const l = byId.get(i.id);
    if (l === undefined) missingByCause.unlabelled = (missingByCause.unlabelled ?? 0) + 1;
    else if (l.binary === null) missingByCause[l.raw] = (missingByCause[l.raw] ?? 0) + 1;
  }
  const valid = items.filter((i) => model.get(i.id) !== null).length;
  const failed = items.filter((i) => byId.get(i.id)?.procedureFailure ?? true).length;
  const validShare = items.length === 0 ? 0 : 1 - failed / items.length;
  const answeredShare = items.length === 0 ? 0 : valid / items.length;
  const hh = pairStats(hhPairs(items));
  const mh = pairStats(mhPairs(items, model));
  const delta = mh.alpha === null || hh.alpha === null ? null : mh.alpha - hh.alpha;
  const boot = bootstrapDelta(items, model);
  const sensMh = pairStats(mhPairs(items, sensModel));
  return {
    rater, arm, items: items.length, valid, validShare, answeredShare, missingByCause, hh, mh, delta, deltaLow: boot.low, deltaHigh: boot.high,
    consensus: consensusStats(items, model),
    decision: decide(validShare, answeredShare, hh.alpha, delta, boot.low, boot.high),
    sensitivity: { mh: sensMh, delta: sensMh.alpha === null || hh.alpha === null ? null : sensMh.alpha - hh.alpha, consensus: consensusStats(items, sensModel) },
  };
}

export function modelModel(items: readonly CalibrationItem[], labels: readonly RaterLabel[], arm: Arm, a: RaterId, b: RaterId): DatasetScore['modelModel'][number] {
  const get = (r: RaterId): Map<string, Binary | null> => new Map(labels.filter((l) => l.rater === r && l.arm === arm).map((l) => [l.itemId, l.binary]));
  const ma = get(a);
  const mb = get(b);
  const t = [[0, 0], [0, 0]];
  for (const i of items) {
    const x = ma.get(i.id);
    const y = mb.get(i.id);
    if (x === null || x === undefined || y === null || y === undefined) continue;
    const row = t[x === 'fail' ? 0 : 1] as number[];
    row[y === 'fail' ? 0 : 1] = (row[y === 'fail' ? 0 : 1] ?? 0) + 1;
  }
  const n = t.flat().reduce((s, v) => s + v, 0);
  return { arm, a, b, n, kappa: n === 0 ? null : finite(cohenKappa(t)), observed: n === 0 ? null : ((t[0]?.[0] ?? 0) + (t[1]?.[1] ?? 0)) / n };
}

export function scoreDataset(dataset: DatasetId, items: readonly CalibrationItem[], labels: readonly RaterLabel[]): DatasetScore {
  const raters = [...new Set(labels.map((l) => l.rater))].sort();
  const arms = [...new Set(labels.map((l) => l.arm))].sort();
  const counts = items.map((i) => humanBinaries(i).length);
  const cons = items.map(consensus).filter((c): c is Binary => c !== null);
  const perRaterArm = raters.flatMap((r) => arms.map((a) => scoreRaterArm(items, labels, r, a)));
  const mm = arms.flatMap((a) => (raters.length >= 2 ? [modelModel(items, labels, a, raters[0] as RaterId, raters[1] as RaterId)] : []));
  return {
    dataset, items: items.length,
    humanRatingsPerItem: counts.length === 0 ? { min: 0, mean: 0, max: 0 } : { min: Math.min(...counts), mean: counts.reduce((s, v) => s + v, 0) / counts.length, max: Math.max(...counts) },
    consensusFailShare: cons.length === 0 ? null : cons.filter((c) => c === 'fail').length / cons.length,
    perRaterArm, modelModel: mm,
  };
}

const f3 = (x: number | null): string => (x === null ? '—' : x.toFixed(3));

export function renderScores(scores: readonly DatasetScore[], header: string): string {
  const L: string[] = [header, ''];
  for (const s of scores) {
    L.push(`## ${s.dataset}`, '', `Items ${String(s.items)}; human ratings per item ${String(s.humanRatingsPerItem.min)}–${String(s.humanRatingsPerItem.max)} (mean ${s.humanRatingsPerItem.mean.toFixed(2)}); human-consensus fail share ${f3(s.consensusFailShare)}.`, '');
    L.push('| Rater | Arm | Binary labels | α H–H (pairs) | α M–H (pairs) | Δ [95 % CI] | κ vs consensus (n) | AC1 | PABAK | Decision | Δ sensitivity |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of s.perRaterArm) {
      L.push(`| ${r.rater} | ${r.arm} | ${String(r.valid)}/${String(r.items)} | ${f3(r.hh.alpha)} (${String(r.hh.pairs)}) | ${f3(r.mh.alpha)} (${String(r.mh.pairs)}) | ${f3(r.delta)} [${f3(r.deltaLow)}, ${f3(r.deltaHigh)}] | ${f3(r.consensus.kappa)} (${String(r.consensus.n)}) | ${f3(r.consensus.ac1)} | ${f3(r.consensus.pabak)} | **${r.decision}** | ${f3(r.sensitivity.delta)} |`);
    }
    if (s.modelModel.length > 0) {
      L.push('', '| Arm | Model–model | n | κ | observed |', '|---|---|---|---|---|');
      for (const m of s.modelModel) L.push(`| ${m.arm} | ${m.a} vs ${m.b} | ${String(m.n)} | ${f3(m.kappa)} | ${f3(m.observed)} |`);
    }
    L.push('');
  }
  return L.join('\n');
}
