/**
 * v1.3 labeller calibration: the stratified, seeded sample (Docs/v1.3/labeller-calibration-plan.md §3).
 *
 * Eligible: at least `minRatings` mapped human ratings. Strata: the task only. The sample is NOT stratified on the
 * human labels: selecting on consensus (or excluding ties) would select on human agreement and bias the human–human
 * reference upwards, which is the quantity the model is compared with. Each stratum is shuffled with a seed derived
 * from (seed, dataset, stratum) and walked in that order: an item whose code cannot be resolved (repository gone, lines out of range) is skipped and the next one
 * taken, until `perStratum` items resolve or the stratum is exhausted (the shortfall is reported, never filled from
 * another stratum).
 */
import { createHash } from 'node:crypto';
import { createRng, shuffle } from '../../../lib/stats.js';
import { humanBinaries } from './score.js';
import type { CalibrationItem, DatasetId, ResolvedItem } from './types.js';

export interface SampleDesign {
  readonly dataset: DatasetId;
  readonly seed: number;
  readonly minRatings: number;
  readonly perStratum: number;
  /** Tasks included (others are ignored). */
  readonly tasks: readonly string[];
}

export function stratumOf(item: CalibrationItem): string {
  return item.task;
}

export function stratumSeed(seed: number, dataset: string, stratum: string): number {
  return Number.parseInt(createHash('sha256').update(`${String(seed)}|${dataset}|${stratum}`).digest('hex').slice(0, 8), 16);
}

/** Per stratum, the eligible items in their seeded order (the walk order of `resolveSample`). */
export function orderedStrata(items: readonly CalibrationItem[], d: SampleDesign): Map<string, CalibrationItem[]> {
  const by = new Map<string, CalibrationItem[]>();
  for (const it of items) {
    if (it.dataset !== d.dataset || !d.tasks.includes(it.task) || humanBinaries(it).length < d.minRatings) continue;
    const s = stratumOf(it);
    by.set(s, [...(by.get(s) ?? []), it]);
  }
  const out = new Map<string, CalibrationItem[]>();
  for (const s of [...by.keys()].sort()) {
    const sorted = [...(by.get(s) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    out.set(s, shuffle(sorted, createRng(stratumSeed(d.seed, d.dataset, s))));
  }
  return out;
}

export interface SampleResult {
  readonly items: ResolvedItem[];
  readonly perStratum: Record<string, { readonly eligible: number; readonly taken: number; readonly skipped: readonly { readonly id: string; readonly why: string }[] }>;
}

/** Walks each stratum until `perStratum` items resolve. `resolve` returns the item with its code or a skip reason. */
export async function resolveSample(
  items: readonly CalibrationItem[], d: SampleDesign,
  resolve: (it: CalibrationItem) => Promise<ResolvedItem | { readonly skip: string }>,
): Promise<SampleResult> {
  const out: ResolvedItem[] = [];
  const perStratum: SampleResult['perStratum'] = {};
  for (const [s, ordered] of orderedStrata(items, d)) {
    const skipped: { id: string; why: string }[] = [];
    let taken = 0;
    for (const it of ordered) {
      if (taken >= d.perStratum) break;
      const r = await resolve(it);
      if ('skip' in r) { skipped.push({ id: it.id, why: r.skip }); continue; }
      out.push(r);
      taken += 1;
    }
    perStratum[s] = { eligible: ordered.length, taken, skipped };
  }
  return { items: out, perStratum };
}
