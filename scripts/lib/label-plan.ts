/**
 * Registered label-plan sizing (ADR-021 item 6; SO3-2, SO4-02; FR-27; BR-U5b-33, 34, 63).
 *
 * The agy route allows about 180 label calls a week, so the live labelling plan is sized explicitly instead of by the
 * cap-derived bound of BR-U5b-34. The registered configuration (`corpus/label-plan-config.json`) fixes:
 *
 * - the call ceiling (`budgetCalls`, at most 300 with both runs) and a reserve for the one re-ask per answer;
 * - per sampled population (P2, P3, P4) the items drawn per stratum (`perStratum`) and the population ceiling
 *   (`maxItems`), and the priority order P4, then P2, then P3 (ADR-021 item 7, last paragraph);
 * - the planned exhaustive load (P1 plus missed seeds), the context ceiling and the quota schedule.
 *
 * Sampling is two-stage. When a population's strata would give more than its ceiling, `m = floor(maxItems /
 * perStratum)` strata are drawn by a seeded simple random sample of the `M` strata, then `min(perStratum, N_h)` items
 * inside each drawn stratum by the existing per-stratum seeded draw. The inclusion probability of an item is
 * `(m / M) * min(perStratum, N_h) / N_h`, which is what the Horvitz–Thompson weights (1 / p) need. When the
 * exhaustive populations leave too little capacity, the ceilings drop in reverse priority order (P3 first, then P2,
 * then P4) before anything is refused.
 *
 * Pure functions only; reading reports, cases and specs is `scripts/build-label-plan.ts`.
 */
import { createHash } from 'node:crypto';
import { candidateItemId, candidateStratum, RUNS_PER_ITEM, SAMPLED_POPULATIONS, strataSeed } from './label-context.js';
import type { Candidate, Population, SampledPopulation, StratumSample } from './label-context.js';
import { createRng, shuffle, wilsonProportion } from './stats.js';

export const LABEL_PLAN_CONFIG_FILE = 'corpus/label-plan-config.json';
export const LABEL_PLAN_CONFIG_INVALID = 'LABEL_PLAN_CONFIG_INVALID';
export const LABEL_PLAN_OVER_BUDGET = 'LABEL_PLAN_OVER_BUDGET';
/** ADR-021 item 6: the whole live labelling plan, both runs included, fits in 300 calls or fewer. */
export const MAX_LIVE_CALLS = 300;
export const CONTEXT_CUT_MARKER = '[context cut at the registered ceiling (ADR-021 item 6)]';

export interface PopulationSizing {
  /** Items drawn inside each drawn stratum. */
  readonly perStratum: number;
  /** Population ceiling before any lowering. */
  readonly maxItems: number;
}

/** `corpus/label-plan-config.json` (registered in P-U6). */
export interface LabelPlanConfig {
  readonly version: 1;
  /** Labeller route and pinned model (ADR-019 item 4 as amended; `Docs/labeller-route.md`). */
  readonly provider: 'agy' | 'gemini' | 'mock';
  readonly model: string;
  readonly budgetCalls: number;
  /** Calls held back for the one re-ask per invalid answer (BR-U5b-29). */
  readonly reaskReserveCalls: number;
  /** Seeds of the label plan: the stratum draw, run 1's order and option permutations, the agreement bootstrap. */
  readonly seeds: { readonly strata: number; readonly permutation: number; readonly bootstrap: number };
  /** Lowering order is the reverse of this list. */
  readonly priority: readonly SampledPopulation[];
  readonly sampled: Readonly<Record<SampledPopulation, PopulationSizing>>;
  /** Planned P1 + missed-seed items (the projection the sizes were chosen for). */
  readonly exhaustivePlanned: number;
  readonly context: { readonly maxChars: number };
  readonly quota: { readonly callsPerWeek: number; readonly minWeeks: number };
}

export function checkLabelPlanConfig(v: unknown): string[] {
  const c = v as Partial<LabelPlanConfig> | null;
  if (c === null || typeof c !== 'object') return ['config is not an object'];
  const errs: string[] = [];
  const int = (x: unknown): boolean => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
  if (c.version !== 1) errs.push('version must be 1');
  if (c.provider !== 'agy' && c.provider !== 'gemini' && c.provider !== 'mock') errs.push('provider must be agy, gemini or mock');
  if (typeof c.model !== 'string' || c.model === '') errs.push('model must be a pinned id');
  if (!int(c.budgetCalls) || (c.budgetCalls ?? 0) > MAX_LIVE_CALLS) errs.push(`budgetCalls must be an integer in 0..${String(MAX_LIVE_CALLS)}`);
  if (!int(c.reaskReserveCalls) || (c.reaskReserveCalls ?? 0) > (c.budgetCalls ?? 0)) errs.push('reaskReserveCalls must be an integer <= budgetCalls');
  if (c.seeds === undefined || !int(c.seeds.strata) || !int(c.seeds.permutation) || !int(c.seeds.bootstrap)) errs.push('seeds.strata, seeds.permutation and seeds.bootstrap must be integers');
  const prio = c.priority ?? [];
  if (prio.length !== SAMPLED_POPULATIONS.length || SAMPLED_POPULATIONS.some((p) => !prio.includes(p))) errs.push('priority must list P2, P3 and P4 once each');
  for (const p of SAMPLED_POPULATIONS) {
    const s = c.sampled?.[p];
    if (s === undefined || !int(s.perStratum) || s.perStratum < 1 || !int(s.maxItems)) errs.push(`sampled.${p} needs perStratum >= 1 and maxItems >= 0`);
  }
  if (!int(c.exhaustivePlanned)) errs.push('exhaustivePlanned must be a non-negative integer');
  if (c.context === undefined || !int(c.context.maxChars) || c.context.maxChars < 200) errs.push('context.maxChars must be an integer >= 200');
  if (c.quota === undefined || !int(c.quota.callsPerWeek) || c.quota.callsPerWeek < 1 || !int(c.quota.minWeeks)) errs.push('quota.callsPerWeek >= 1 and quota.minWeeks must be integers');
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

/** Items the budget pays for after the re-ask reserve. */
export function capacityItems(c: LabelPlanConfig): number {
  return Math.floor((c.budgetCalls - c.reaskReserveCalls) / RUNS_PER_ITEM);
}

// ---------------------------------------------------------------------------------------------
// Ceilings under the budget

/** What a population's strata can give at most: `sum_h min(perStratum, N_h)`. */
export function available(sizes: readonly number[], perStratum: number): number {
  return sizes.reduce((s, n) => s + Math.min(perStratum, n), 0);
}

export interface Ceilings {
  readonly ok: boolean;
  readonly capacityItems: number;
  readonly exhaustive: number;
  /** Final ceiling per population (after lowering), never above what its strata can give. */
  readonly maxItems: Readonly<Record<SampledPopulation, number>>;
  /** Populations whose ceiling was lowered below the registered one because of the budget. */
  readonly lowered: readonly SampledPopulation[];
  readonly detail?: string;
}

/**
 * The ceilings that fit the budget: P1 and MS first (exhaustive); each sampled population gets
 * `min(registered maxItems, available)`; while the total exceeds the capacity, the last population in priority order
 * is lowered (to 0 if need be) before the next one. Refused when P1 + MS alone exceed the capacity.
 */
export function ceilingsFor(c: LabelPlanConfig, exhaustive: number, sizes: Readonly<Record<SampledPopulation, readonly number[]>>): Ceilings {
  const cap = capacityItems(c);
  const max: Record<SampledPopulation, number> = { P2: 0, P3: 0, P4: 0 };
  for (const p of SAMPLED_POPULATIONS) max[p] = Math.min(c.sampled[p].maxItems, available(sizes[p], c.sampled[p].perStratum));
  if (exhaustive > cap) {
    return {
      ok: false, capacityItems: cap, exhaustive, maxItems: { P2: 0, P3: 0, P4: 0 }, lowered: [...SAMPLED_POPULATIONS],
      detail: `${LABEL_PLAN_OVER_BUDGET}: P1 + missed seeds = ${String(exhaustive)} items need ${String(exhaustive * RUNS_PER_ITEM)} calls > ${String(cap * RUNS_PER_ITEM)} (budget ${String(c.budgetCalls)} - reserve ${String(c.reaskReserveCalls)}); report the gap as a limitation (ADR-021 item 7)`,
    };
  }
  const lowered: SampledPopulation[] = [];
  let over = exhaustive + SAMPLED_POPULATIONS.reduce((s, p) => s + max[p], 0) - cap;
  for (const p of [...c.priority].reverse()) {
    if (over <= 0) break;
    const cut = Math.min(over, max[p]);
    if (cut > 0) lowered.push(p);
    max[p] -= cut;
    over -= cut;
  }
  return { ok: true, capacityItems: cap, exhaustive, maxItems: max, lowered };
}

// ---------------------------------------------------------------------------------------------
// Two-stage sampling

/** Seed of the stratum draw of one population (independent of every other population). */
export function stratumDrawSeed(seed: number, population: Population): number {
  return createHash('sha256').update(JSON.stringify([seed, 'strata', population])).digest().readUInt32BE(0);
}

export interface RegisteredSample<C extends Candidate = Candidate> extends StratumSample<C> {
  /** `m / M` of the stratum draw (1 when every stratum is kept). */
  readonly stratumInclusionProbability: number;
}

/**
 * Samples one sampled population: all strata, or `m = floor(maxItems / perStratum)` of the `M` strata (seeded SRS
 * over the sorted stratum names), then `min(perStratum, N_h)` items per kept stratum by a seeded shuffle of the
 * stratum's candidates sorted by item id. Strata not drawn are returned with no sampled items, so their sizes
 * stay in the plan. `itemSeed(stratum)` gives the within-stratum seed (the source plan's `sampling` seed).
 */
export function sampleRegistered<C extends Candidate>(
  candidates: readonly C[],
  population: SampledPopulation,
  sizing: PopulationSizing,
  maxItems: number,
  strataSeedValue: number,
  itemSeed: (stratum: string) => number,
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
  const fits = available(names.map((n) => groups.get(n)?.size ?? 0), perStratum) <= maxItems;
  const m = fits ? M : Math.min(M, Math.floor(maxItems / perStratum));
  const kept = new Set(fits ? names : shuffle(names, createRng(stratumDrawSeed(strataSeedValue, population))).slice(0, m));
  const pStratum = M === 0 ? 1 : m / M;
  return names.map((stratum) => {
    const members = [...(groups.get(stratum) ?? new Map<string, C>()).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const size = members.length;
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
  readonly population: string;
  readonly n: number;
  /** Wilson 95 % half-width at p = 0.5 (worst case) and at p = 0.85, at nominal n; `null` when n < 10. */
  readonly halfWidthAt50: number | null;
  readonly halfWidthAt85: number | null;
}

/**
 * The precision the registered sizes allow (ADR-021 item 6), stated before any run: the Wilson half-width at the
 * nominal item count. Unequal weights shrink the effective size (Kish), so these are lower bounds on the widths.
 */
export function precisionStatement(population: string, n: number): PrecisionStatement {
  if (n < 10) return { population, n, halfWidthAt50: null, halfWidthAt85: null };
  const hw = (p: number): number => {
    const iv = wilsonProportion(p, n);
    return (iv.high - iv.low) / 2;
  };
  return { population, n, halfWidthAt50: hw(0.5), halfWidthAt85: hw(0.85) };
}

/** Weeks of quota a call count needs, never fewer than the registered minimum. */
export function weeksNeeded(c: LabelPlanConfig, calls: number): number {
  return Math.max(c.quota.minWeeks, Math.ceil(calls / c.quota.callsPerWeek));
}
