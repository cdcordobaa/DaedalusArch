/**
 * Registered label-plan sizing (ADR-021 items 6 and 8; SO3-2, SO4-02; FR-27; BR-U5b-33, 34, 63).
 *
 * The agy route allows about 180 label calls a week, so the live labelling plan is sized explicitly instead of by the
 * cap-derived bound of BR-U5b-34. The registered configuration (`corpus/label-plan-config.json`, version 2 from P-U6)
 * fixes:
 *
 * - the call ceiling (`budgetCalls`, at most 300 with both runs) and a reserve for the one re-ask per answer and the
 *   agy retries (the budget counts agy invocations, ADR-021 item 8.7);
 * - per sampled population (P2, P3, P4) the items drawn per stratum (`perStratum`), the population ceiling
 *   (`maxItems`) and the stratum draw (`srs`, or `pps` = probability proportional to stratum size, which makes a
 *   one-per-stratum sample self-weighting; P2 uses it, item 8.3), and the priority order P4, then P2, then P3;
 *   P3 is out of live labelling (`maxItems` 0, item 8.1);
 * - the planned exhaustive load (P1 plus missed seeds) with its stated basis, and the escalation rule (item 8.2):
 *   when P1 + MS exceed what the base budget pays for, the budget grows in whole weeks of `quota.callsPerWeek` calls
 *   up to `quota.maxWeeks`, before any sampled ceiling is lowered; a plan is never refused for its size;
 * - the context ceiling per item kind (item 8.6) and the seeds, the audit seed included (item 8.5);
 * - since version 3 (ADR-026; `Docs/analysis-plan.md` §10 B8), the P2 split between its two disjoint frames: of the
 *   `sampled.P2.maxItems` items, `sampled.P2.v1OnlyMaxItems` come from the **v1-only stratum set** (the violations a
 *   v1 symbolic-only re-evaluation of the same stored code adds, i.e. the rows the v2 role exemptions remove) and the
 *   rest from the **v2 population**; each frame is drawn by the §4 PPS rule with its own inclusion probabilities.
 *
 * Sampling is two-stage. When a population's strata would give more than its ceiling, `m = floor(maxItems /
 * perStratum)` strata are drawn (SRS: each with `pi_h = m / M`; PPS: `pi_h = m' N_h / N'` after the certainty strata
 * whose `m N_h / N >= 1` are taken whole, by systematic PPS over a seeded order), then `min(perStratum, N_h)` items
 * inside each drawn stratum by the existing per-stratum seeded draw. The inclusion probability of an item is
 * `pi_h * min(perStratum, N_h) / N_h`, which is what the Horvitz–Thompson weights (1 / p) need.
 *
 * Pure functions only; reading reports, cases and specs is `scripts/build-label-plan.ts`.
 */
import { createHash } from 'node:crypto';
import { candidateItemId, candidateStratum, RUNS_PER_ITEM, SAMPLED_POPULATIONS, strataSeed } from './label-context.js';
import type { Candidate, ItemKind, Population, SampledPopulation, StratumSample } from './label-context.js';
import { createRng, kishEffectiveN, shuffle, wilsonProportion } from './stats.js';
import type { SeededRng } from './stats.js';

export const LABEL_PLAN_CONFIG_FILE = 'corpus/label-plan-config.json';
export const LABEL_PLAN_CONFIG_VERSION = 3;
export const LABEL_PLAN_CONFIG_INVALID = 'LABEL_PLAN_CONFIG_INVALID';
/** Not a refusal since ADR-021 item 8.2: the code names a plan whose P1 + MS exceed even the escalated budget. */
export const LABEL_PLAN_OVER_BUDGET = 'LABEL_PLAN_OVER_BUDGET';
/** ADR-021 item 6: the base live labelling plan, both runs included, fits in 300 calls or fewer. */
export const MAX_LIVE_CALLS = 300;
export const CONTEXT_CUT_MARKER = '[context cut at the registered ceiling (ADR-021 item 6)]';
export const ITEM_KINDS: readonly ItemKind[] = ['violation', 'judge-unit', 'missed-seed'];

export type StrataDraw = 'srs' | 'pps';

export interface PopulationSizing {
  /** Items drawn inside each drawn stratum. */
  readonly perStratum: number;
  /** Population ceiling before any lowering. */
  readonly maxItems: number;
  /** Stratum draw when not every stratum fits (default `srs`). */
  readonly strataDraw?: StrataDraw;
  /**
   * P2 only (version 3, ADR-026): the items of `maxItems` drawn from the v1-only stratum set; the remaining
   * `maxItems - v1OnlyMaxItems` are drawn from the v2 population. Required on P2, refused on P3 and P4.
   */
  readonly v1OnlyMaxItems?: number;
}

/** Stratum-name prefix of the v1-only P2 strata (`'v1-only: <project>, <function>'`; ADR-026, analysis plan B8). */
export const V1_ONLY_STRATUM_PREFIX = 'v1-only: ';

/** The P2 frame of a stratum name: the v1-only stratum set, else the v2 population. */
export type P2Frame = 'v2' | 'v1-only';

export function p2FrameOf(stratum: string): P2Frame {
  return stratum.startsWith(V1_ONLY_STRATUM_PREFIX) ? 'v1-only' : 'v2';
}

/** `corpus/label-plan-config.json` (registered in P-U6). */
export interface LabelPlanConfig {
  readonly version: 3;
  /** Labeller route and pinned model (ADR-019 item 4 as amended; `Docs/labeller-route.md`). */
  readonly provider: 'agy' | 'gemini' | 'mock';
  readonly model: string;
  /** Base call ceiling (agy invocations, re-asks and retries included). */
  readonly budgetCalls: number;
  /** Invocations held back for the one re-ask per invalid answer (BR-U5b-29) and the provider retries. */
  readonly reaskReserveCalls: number;
  /**
   * Seeds: the stratum draw, run 1's order and option permutations, the agreement bootstrap and the blinded audit
   * draw (item 8.5; `llm-label --allocate-audit` refuses any other `--seed`).
   */
  readonly seeds: { readonly strata: number; readonly permutation: number; readonly bootstrap: number; readonly audit: number };
  /** Lowering order is the reverse of this list. */
  readonly priority: readonly SampledPopulation[];
  readonly sampled: Readonly<Record<SampledPopulation, PopulationSizing>>;
  /** Planned P1 + missed-seed items (the projection the sizes were chosen for). */
  readonly exhaustivePlanned: number;
  /** Where the projection comes from (item 8.2: the fixture or spike FP counts). */
  readonly exhaustivePlannedBasis: string;
  /** Context ceiling in characters per item kind (item 8.6). */
  readonly context: { readonly maxChars: Readonly<Record<ItemKind, number>> };
  /** Quota schedule and the escalation limit (item 8.2). */
  readonly quota: { readonly callsPerWeek: number; readonly minWeeks: number; readonly maxWeeks: number };
}

export function checkLabelPlanConfig(v: unknown): string[] {
  const c = v as Partial<LabelPlanConfig> | null;
  if (c === null || typeof c !== 'object') return ['config is not an object'];
  const errs: string[] = [];
  const int = (x: unknown): boolean => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
  if (c.version !== LABEL_PLAN_CONFIG_VERSION) errs.push(`version must be ${String(LABEL_PLAN_CONFIG_VERSION)}`);
  if (c.provider !== 'agy' && c.provider !== 'gemini' && c.provider !== 'mock') errs.push('provider must be agy, gemini or mock');
  if (typeof c.model !== 'string' || c.model === '') errs.push('model must be a pinned id');
  if (!int(c.budgetCalls) || (c.budgetCalls ?? 0) > MAX_LIVE_CALLS) errs.push(`budgetCalls must be an integer in 0..${String(MAX_LIVE_CALLS)}`);
  if (!int(c.reaskReserveCalls) || (c.reaskReserveCalls ?? 0) > (c.budgetCalls ?? 0)) errs.push('reaskReserveCalls must be an integer <= budgetCalls');
  const s = c.seeds;
  if (s === undefined || !int(s.strata) || !int(s.permutation) || !int(s.bootstrap) || !int(s.audit)) errs.push('seeds.strata, seeds.permutation, seeds.bootstrap and seeds.audit must be integers');
  const prio = c.priority ?? [];
  if (prio.length !== SAMPLED_POPULATIONS.length || SAMPLED_POPULATIONS.some((p) => !prio.includes(p))) errs.push('priority must list P2, P3 and P4 once each');
  for (const p of SAMPLED_POPULATIONS) {
    const z = c.sampled?.[p];
    if (z === undefined || !int(z.perStratum) || z.perStratum < 1 || !int(z.maxItems)) errs.push(`sampled.${p} needs perStratum >= 1 and maxItems >= 0`);
    else {
      const draw: unknown = z.strataDraw;
      if (draw !== undefined && draw !== 'srs' && draw !== 'pps') errs.push(`sampled.${p}.strataDraw must be srs or pps`);
      const v1 = z.v1OnlyMaxItems;
      if (p === 'P2' && (typeof v1 !== 'number' || !int(v1) || v1 > z.maxItems)) errs.push('sampled.P2.v1OnlyMaxItems must be an integer in 0..sampled.P2.maxItems (ADR-026)');
      if (p !== 'P2' && v1 !== undefined) errs.push(`sampled.${p}.v1OnlyMaxItems is a P2 field only`);
    }
  }
  if (!int(c.exhaustivePlanned)) errs.push('exhaustivePlanned must be a non-negative integer');
  if (typeof c.exhaustivePlannedBasis !== 'string' || c.exhaustivePlannedBasis.trim() === '') errs.push('exhaustivePlannedBasis must state the basis of the P1 + MS projection');
  const maxChars = c.context?.maxChars as Partial<Record<ItemKind, unknown>> | undefined;
  for (const k of ITEM_KINDS) {
    const m = maxChars?.[k];
    if (!int(m) || (m as number) < 200) errs.push(`context.maxChars.${k} must be an integer >= 200`);
  }
  const q = c.quota;
  if (q === undefined || !int(q.callsPerWeek) || q.callsPerWeek < 1 || !int(q.minWeeks) || !int(q.maxWeeks)) {
    errs.push('quota.callsPerWeek >= 1, quota.minWeeks and quota.maxWeeks must be integers');
  } else if (q.maxWeeks * q.callsPerWeek < (c.budgetCalls ?? 0)) {
    errs.push('quota.maxWeeks x quota.callsPerWeek must be at least budgetCalls');
  }
  if (errs.length === 0) {
    const planned = registeredItemCeiling(c as LabelPlanConfig) + (c.exhaustivePlanned ?? 0);
    if (planned * RUNS_PER_ITEM + (c.reaskReserveCalls ?? 0) > (c.budgetCalls ?? 0)) {
      errs.push(`registered sizes need ${String(planned * RUNS_PER_ITEM)} calls + reserve ${String(c.reaskReserveCalls)} > budget ${String(c.budgetCalls)}`);
    }
  }
  return errs;
}

/** Sum of the registered population ceilings. */
export function registeredItemCeiling(c: LabelPlanConfig): number {
  return SAMPLED_POPULATIONS.reduce((s, p) => s + c.sampled[p].maxItems, 0);
}

/** Items a call budget pays for after the re-ask reserve. */
export function capacityOf(c: LabelPlanConfig, budgetCalls: number): number {
  return Math.max(0, Math.floor((budgetCalls - c.reaskReserveCalls) / RUNS_PER_ITEM));
}

/** Items the base budget pays for after the re-ask reserve. */
export function capacityItems(c: LabelPlanConfig): number {
  return capacityOf(c, c.budgetCalls);
}

// ---------------------------------------------------------------------------------------------
// Budget escalation and ceilings (ADR-021 item 8.2)

/** What a population's strata can give at most: `sum_h min(perStratum, N_h)`. */
export function available(sizes: readonly number[], perStratum: number): number {
  return sizes.reduce((s, n) => s + Math.min(perStratum, n), 0);
}

export interface EscalatedBudget {
  readonly budgetCalls: number;
  readonly escalated: boolean;
}

/**
 * The pre-committed escalation rule: when `exhaustive` (P1 + MS) exceeds the base capacity, the budget becomes the
 * smallest whole number of weeks `w * callsPerWeek` (w above the base budget's whole weeks, at most `maxWeeks`) whose
 * capacity holds the exhaustive items and the sampled ceilings; `maxWeeks` weeks when none does.
 */
export function escalatedBudget(c: LabelPlanConfig, exhaustive: number, sampledWanted: number): EscalatedBudget {
  if (exhaustive <= capacityItems(c)) return { budgetCalls: c.budgetCalls, escalated: false };
  const per = c.quota.callsPerWeek;
  for (let w = Math.floor(c.budgetCalls / per) + 1; w <= c.quota.maxWeeks; w += 1) {
    if (exhaustive + sampledWanted <= capacityOf(c, w * per)) return { budgetCalls: w * per, escalated: true };
  }
  return { budgetCalls: Math.max(c.budgetCalls, c.quota.maxWeeks * per), escalated: true };
}

export interface Ceilings {
  /** Always true since ADR-021 item 8.2 (kept for the callers' result shape). */
  readonly ok: true;
  /** The plan's budget after escalation. */
  readonly budgetCalls: number;
  readonly escalated: boolean;
  readonly capacityItems: number;
  readonly exhaustive: number;
  /** Exhaustive items kept: all of them, or the capacity when even `maxWeeks` cannot hold them (then thinned). */
  readonly exhaustiveKept: number;
  /** Final ceiling per population (after lowering), never above what its strata can give. */
  readonly maxItems: Readonly<Record<SampledPopulation, number>>;
  /** The P2 ceiling split between its frames (`v2 + v1Only = maxItems.P2`; ADR-026). */
  readonly p2Split: P2Split;
  /** Populations whose ceiling was lowered below the registered one because of the budget. */
  readonly lowered: readonly SampledPopulation[];
  /** Set when P1 + MS exceed the escalated capacity (`LABEL_PLAN_OVER_BUDGET`, a reported limitation). */
  readonly detail?: string;
}

/**
 * The ceilings that fit the budget. Each sampled population gets `min(registered maxItems, available)`. When P1 + MS
 * exceed the base capacity the budget escalates first (`escalatedBudget`); then, while the total exceeds the
 * capacity, the last population in priority order is lowered (to 0 if need be) before the next one. If P1 + MS alone
 * exceed the escalated capacity, the sampled ceilings are 0 and the exhaustive populations are thinned to the
 * capacity by a seeded simple random sample (`thinExhaustive`); the plan is never refused. P2's ceiling is the sum of
 * its two frames (`p2Split`, ADR-026): `v1OnlySizes` are the stratum sizes of the v1-only set, `sizes.P2` those of the
 * v2 population.
 */
export function ceilingsFor(
  c: LabelPlanConfig,
  exhaustive: number,
  sizes: Readonly<Record<SampledPopulation, readonly number[]>>,
  v1OnlySizes: readonly number[] = [],
): Ceilings {
  const max: Record<SampledPopulation, number> = { P2: 0, P3: 0, P4: 0 };
  for (const p of SAMPLED_POPULATIONS) max[p] = Math.min(c.sampled[p].maxItems, available(sizes[p], c.sampled[p].perStratum));
  max.P2 = p2Split(c, Number.POSITIVE_INFINITY, sizes.P2, v1OnlySizes).total;
  const wanted = SAMPLED_POPULATIONS.reduce((s, p) => s + max[p], 0);
  const budget = escalatedBudget(c, exhaustive, wanted);
  const cap = capacityOf(c, budget.budgetCalls);
  const common = { ok: true as const, budgetCalls: budget.budgetCalls, escalated: budget.escalated, capacityItems: cap, exhaustive };
  if (exhaustive > cap) {
    return {
      ...common, exhaustiveKept: cap, maxItems: { P2: 0, P3: 0, P4: 0 }, p2Split: { v2: 0, v1Only: 0 }, lowered: SAMPLED_POPULATIONS.filter((p) => max[p] > 0),
      detail: `${LABEL_PLAN_OVER_BUDGET}: P1 + missed seeds = ${String(exhaustive)} items exceed the ${String(cap)} items of ${String(budget.budgetCalls)} calls (maxWeeks ${String(c.quota.maxWeeks)}); `
        + `they are thinned to ${String(cap)} by a seeded simple random sample with p = ${String(cap)}/${String(exhaustive)}, and the gap is reported as a limitation (ADR-021 item 8.2)`,
    };
  }
  const lowered: SampledPopulation[] = [];
  let over = exhaustive + wanted - cap;
  for (const p of [...c.priority].reverse()) {
    if (over <= 0) break;
    const cut = Math.min(over, max[p]);
    if (cut > 0) lowered.push(p);
    max[p] -= cut;
    over -= cut;
  }
  const split = p2Split(c, max.P2, sizes.P2, v1OnlySizes);
  return { ...common, exhaustiveKept: exhaustive, maxItems: { ...max, P2: split.total }, p2Split: { v2: split.v2, v1Only: split.v1Only }, lowered };
}

export interface P2Split {
  /** Items drawn from the v2 population. */
  readonly v2: number;
  /** Items drawn from the v1-only stratum set. */
  readonly v1Only: number;
}

/**
 * The P2 ceiling split between its two frames (ADR-026; analysis plan §10 B8). Registered: `maxItems -
 * v1OnlyMaxItems` from the v2 population and `v1OnlyMaxItems` from the v1-only set (24 and 6), each capped by what
 * its own strata can give; a frame that cannot fill its share leaves it unused (no reallocation, so each frame's
 * registered size and inclusion probabilities stay its own). When the budget lowers P2 to `limit` below that, the
 * v1-only share is `floor(limit * v1OnlyMaxItems / maxItems)` (the registered ratio, rounded down) and the v2
 * population takes the rest; a share one frame cannot use goes to the other only in that lowered case, so the
 * lowered total is never wasted.
 */
export function p2Split(c: LabelPlanConfig, limit: number, v2Sizes: readonly number[], v1OnlySizes: readonly number[]): P2Split & { readonly total: number } {
  const z = c.sampled.P2;
  const v1Registered = z.v1OnlyMaxItems ?? 0;
  const v2Cap = Math.min(z.maxItems - v1Registered, available(v2Sizes, z.perStratum));
  const v1Cap = Math.min(v1Registered, available(v1OnlySizes, z.perStratum));
  if (v2Cap + v1Cap <= limit) return { v2: v2Cap, v1Only: v1Cap, total: v2Cap + v1Cap };
  const l = Math.max(0, limit);
  let v1Only = Math.min(v1Cap, z.maxItems === 0 ? 0 : Math.floor((l * v1Registered) / z.maxItems));
  const v2 = Math.min(v2Cap, l - v1Only);
  v1Only = Math.min(v1Cap, l - v2);
  return { v2, v1Only, total: v2 + v1Only };
}

/** Seed of the exhaustive thinning draw (only used past the escalation limit). */
export function exhaustiveThinSeed(seed: number): number {
  return createHash('sha256').update(JSON.stringify([seed, 'exhaustive-thin'])).digest().readUInt32BE(0);
}

/**
 * Thins the exhaustive samples (P1, MS) to `keep` items by one seeded simple random sample over all of their items
 * (sorted by item id); every kept item gets `p = keep / total`. Unchanged when `keep >= total`.
 */
export function thinExhaustive<C extends Candidate>(samples: readonly StratumSample<C>[], keep: number, seed: number): StratumSample<C>[] {
  const all = samples.flatMap((s) => s.sampled.map((i) => i.itemId)).sort();
  if (keep >= all.length) return [...samples];
  const kept = new Set(shuffle(all, createRng(exhaustiveThinSeed(seed))).slice(0, keep));
  const p = all.length === 0 ? 1 : keep / all.length;
  return samples.map((s) => ({ ...s, sampled: s.sampled.filter((i) => kept.has(i.itemId)).map((i) => ({ ...i, inclusionProbability: p })) }));
}

// ---------------------------------------------------------------------------------------------
// Two-stage sampling

/** Seed of the stratum draw of one population (independent of every other population). */
export function stratumDrawSeed(seed: number, population: Population, frame?: string): number {
  const parts: unknown[] = [seed, 'strata', population];
  if (frame !== undefined) parts.push(frame);
  return createHash('sha256').update(JSON.stringify(parts)).digest().readUInt32BE(0);
}

/**
 * Stratum inclusion probabilities of a PPS draw of `m` strata by size: strata with `m' N_h / N' >= 1` are taken with
 * certainty (repeatedly, as the remainder shrinks); the rest get `pi_h = m' N_h / N'`, which sum to `m'`.
 */
export function ppsInclusion(sizes: ReadonlyMap<string, number>, m: number): Map<string, number> {
  const pi = new Map<string, number>();
  const names = [...sizes.keys()].sort();
  if (m >= names.length) {
    for (const n of names) pi.set(n, 1);
    return pi;
  }
  const certain = new Set<string>();
  for (;;) {
    const rest = names.filter((n) => !certain.has(n));
    const left = m - certain.size;
    const total = rest.reduce((s, n) => s + (sizes.get(n) ?? 0), 0);
    const add = rest.filter((n) => left > 0 && total > 0 && (left * (sizes.get(n) ?? 0)) / total >= 1);
    if (add.length === 0) {
      for (const n of certain) pi.set(n, 1);
      for (const n of rest) pi.set(n, total === 0 || left <= 0 ? 0 : (left * (sizes.get(n) ?? 0)) / total);
      return pi;
    }
    for (const n of add) certain.add(n);
  }
}

/**
 * Systematic PPS selection with the probabilities of `ppsInclusion`: the certainty strata, then, over a seeded order
 * of the others, the strata whose cumulative interval holds `u + j` (j = 0..m' - 1, `u` uniform in [0, 1)).
 */
export function ppsSystematic(pi: ReadonlyMap<string, number>, rng: SeededRng): Set<string> {
  const kept = new Set([...pi].filter(([, p]) => p >= 1).map(([n]) => n));
  const rest = shuffle([...pi].filter(([, p]) => p > 0 && p < 1).map(([n]) => n).sort(), rng);
  const u = rng.next();
  let cum = 0;
  let next = u;
  for (const n of rest) {
    const lo = cum;
    cum += pi.get(n) ?? 0;
    if (next >= lo && next < cum - 1e-12) {
      kept.add(n);
      next += 1;
    }
  }
  return kept;
}

export interface RegisteredSample<C extends Candidate = Candidate> extends StratumSample<C> {
  /** `pi_h` of the stratum draw (1 when every stratum is kept; `m / M` under SRS). */
  readonly stratumInclusionProbability: number;
}

/**
 * Samples one sampled population: all strata, or `m = floor(maxItems / perStratum)` of the `M` strata (SRS over the
 * sorted stratum names, or systematic PPS by stratum size), then `min(perStratum, N_h)` items per kept stratum by a
 * seeded shuffle of the stratum's candidates sorted by item id. Strata not drawn are returned with no sampled items,
 * so their sizes stay in the plan. `itemSeed(stratum)` gives the within-stratum seed (the source plan's `sampling`
 * seed). `frame` (the v1-only P2 set, ADR-026) gives the frame its own stratum-draw stream, so the v2 draw is the
 * same with or without it.
 */
export function sampleRegistered<C extends Candidate>(
  candidates: readonly C[],
  population: SampledPopulation,
  sizing: PopulationSizing,
  maxItems: number,
  strataSeedValue: number,
  itemSeed: (stratum: string) => number,
  frame?: string,
): RegisteredSample<C>[] {
  const groups = new Map<string, Map<string, C>>();
  for (const c of candidates) {
    if (c.population !== population) continue;
    const s = candidateStratum(c);
    const g = groups.get(s) ?? new Map<string, C>();
    g.set(candidateItemId(c), c);
    groups.set(s, g);
  }
  const names = [...groups.keys()].sort();
  const M = names.length;
  const perStratum = sizing.perStratum;
  const sizeOf = (n: string): number => groups.get(n)?.size ?? 0;
  const fits = available(names.map(sizeOf), perStratum) <= maxItems;
  const m = fits ? M : Math.min(M, Math.floor(maxItems / perStratum));
  const rng = createRng(stratumDrawSeed(strataSeedValue, population, frame));
  let pi: Map<string, number>;
  let kept: Set<string>;
  if (fits) {
    pi = new Map(names.map((n) => [n, 1]));
    kept = new Set(names);
  } else if ((sizing.strataDraw ?? 'srs') === 'pps') {
    pi = ppsInclusion(new Map(names.map((n) => [n, sizeOf(n)])), m);
    kept = ppsSystematic(pi, rng);
  } else {
    pi = new Map(names.map((n) => [n, M === 0 ? 1 : m / M]));
    kept = new Set(shuffle(names, rng).slice(0, m));
  }
  return names.map((stratum) => {
    const members = [...(groups.get(stratum) ?? new Map<string, C>()).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const size = members.length;
    const pStratum = pi.get(stratum) ?? 0;
    if (!kept.has(stratum)) return { population, stratum, size, cap: perStratum, sampled: [], stratumInclusionProbability: pStratum };
    const take = Math.min(perStratum, size);
    const chosen = size > take
      ? shuffle(members, createRng(strataSeed(itemSeed(stratum), population, stratum))).slice(0, take).sort(([a], [b]) => (a < b ? -1 : 1))
      : members;
    const p = pStratum * (size === 0 ? 1 : take / size);
    return {
      population, stratum, size, cap: perStratum, stratumInclusionProbability: pStratum,
      sampled: chosen.map(([itemId, candidate]) => ({ candidate, itemId, inclusionProbability: p })),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Context ceiling and precision statements

/** Cuts a context at the last line break before `maxChars` and marks the cut (ADR-021 item 6). */
export function trimContext(context: string, maxChars: number): { text: string; cut: boolean } {
  if (context.length <= maxChars) return { text: context, cut: false };
  const room = Math.max(0, maxChars - CONTEXT_CUT_MARKER.length - 1);
  const head = context.slice(0, room);
  const nl = head.lastIndexOf('\n');
  return { text: `${nl > 0 ? head.slice(0, nl) : head}\n${CONTEXT_CUT_MARKER}`, cut: true };
}

/** Rough input-token estimate of a context (4 characters per token, the U4 `CHARS_PER_TOKEN` convention). */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export interface PrecisionStatement {
  /** The reported row (E1 headline, fixtures, a generator, P2 overall, a census). */
  readonly row: string;
  /** Nominal item count. */
  readonly n: number;
  /** Kish effective n = (Σw)² / Σw² of the items' design weights (ADR-021 item 8.3). */
  readonly nEff: number;
  /** Wilson 95 % half-width at the effective n, at p = 0.5 (worst case) and p = 0.85; `null` when n_eff < 10. */
  readonly halfWidthAt50: number | null;
  readonly halfWidthAt85: number | null;
}

/**
 * The precision a row's sample allows, stated before any run (ADR-021 items 6, 8.3): the Wilson half-width at the
 * Kish effective n of the row's weights (1 / p). Equal weights give n_eff = n. `countsOnly` states n and n_eff
 * without a half-width (the v1-only P2 part, reported as counts only, analysis plan B8).
 */
export function precisionStatement(row: string, weights: readonly number[], countsOnly = false): PrecisionStatement {
  const n = weights.length;
  const nEff = n === 0 ? 0 : kishEffectiveN(weights);
  if (countsOnly || nEff < 10) return { row, n, nEff, halfWidthAt50: null, halfWidthAt85: null };
  const hw = (p: number): number => {
    const iv = wilsonProportion(p, nEff);
    return (iv.high - iv.low) / 2;
  };
  return { row, n, nEff, halfWidthAt50: hw(0.5), halfWidthAt85: hw(0.85) };
}

/** Weeks of quota a call count needs, never fewer than the registered minimum. */
export function weeksNeeded(c: LabelPlanConfig, calls: number): number {
  return Math.max(c.quota.minWeeks, Math.ceil(calls / c.quota.callsPerWeek));
}
