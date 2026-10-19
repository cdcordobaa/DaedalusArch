/**
 * MEAN-01 meaning analysis: item bootstrap and stratified cluster bootstrap (design BR-40 to BR-43; codebook §4.7,
 * §9.2). Both run on `createRng` (mulberry32) and `quantileSorted` of `scripts/lib/stats.ts`, with one fresh RNG per
 * call so each interval is reproducible on its own.
 */
import { createRng, quantileSorted } from '../../../lib/stats.js';
import { cmp } from './load.js';
import type { BootInterval } from './types.js';

/** A statistic of a resample: `value` null (or not finite) = undefined; `emptyStratum` = a stratum was left out (BR-42). */
export interface StatValue {
  readonly value: number | null;
  readonly emptyStratum?: boolean;
}
export type Statistic<T> = (sample: readonly T[]) => StatValue;

export interface BootOptions {
  readonly seed: number;
  readonly resamples: number;
}

function summarise(method: BootInterval['method'], opts: BootOptions, values: number[], undefinedResamples: number, empty: number): BootInterval {
  values.sort((a, b) => a - b);
  const defined = values.length;
  return {
    method,
    seed: opts.seed,
    resamples: opts.resamples,
    low: defined === 0 ? null : quantileSorted(values, 0.025),
    high: defined === 0 ? null : quantileSorted(values, 0.975),
    definedResamples: defined,
    undefinedResamples,
    resamplesWithEmptyStratum: empty,
  };
}

function checkOpts(opts: BootOptions): void {
  if (!Number.isInteger(opts.resamples) || opts.resamples <= 0) throw new RangeError(`bootstrap: resamples must be a positive integer, got ${String(opts.resamples)}`);
}

function run<T>(method: BootInterval['method'], opts: BootOptions, draw: (rng: ReturnType<typeof createRng>) => T[], stat: Statistic<T>): BootInterval {
  const rng = createRng(opts.seed);
  const values: number[] = [];
  let undef = 0;
  let empty = 0;
  for (let r = 0; r < opts.resamples; r += 1) {
    const s = stat(draw(rng));
    if (s.emptyStratum === true) empty += 1;
    if (s.value === null || !Number.isFinite(s.value)) undef += 1;
    else values.push(s.value);
  }
  return summarise(method, opts, values, undef, empty);
}

/** BR-40: resample the n items with replacement (n draws of rng.int(n)). With no item every resample is undefined. */
export function itemBootstrap<T>(items: readonly T[], stat: Statistic<T>, opts: BootOptions): BootInterval {
  checkOpts(opts);
  const n = items.length;
  if (n === 0) return summarise('item', opts, [], opts.resamples, 0);
  return run('item', opts, (rng) => {
    const out: T[] = new Array<T>(n);
    for (let i = 0; i < n; i += 1) out[i] = items[rng.int(n)] as T;
    return out;
  }, stat);
}

export interface ClusterKey {
  readonly stratum: string;
  readonly project: string;
  readonly itemId: string;
}

/**
 * BR-41: the cluster is a (stratum, project) cell. Strata in sorted name order; within each, its cells (sorted by
 * project id) are resampled with replacement, as many draws as it has cells. Items within a cell keep itemId order.
 */
export function stratifiedClusterBootstrap<T>(items: readonly T[], key: (t: T) => ClusterKey, stat: Statistic<T>, opts: BootOptions): BootInterval {
  checkOpts(opts);
  if (items.length === 0) return summarise('stratified-cluster', opts, [], opts.resamples, 0);
  const strata = new Map<string, Map<string, T[]>>();
  for (const it of items) {
    const k = key(it);
    const cells = strata.get(k.stratum) ?? new Map<string, T[]>();
    cells.set(k.project, [...(cells.get(k.project) ?? []), it]);
    strata.set(k.stratum, cells);
  }
  const layout: T[][][] = [...strata.keys()].sort(cmp).map((s) => {
    const cells = strata.get(s) ?? new Map<string, T[]>();
    return [...cells.keys()].sort(cmp).map((p) => [...(cells.get(p) ?? [])].sort((a, b) => cmp(key(a).itemId, key(b).itemId)));
  });
  return run('stratified-cluster', opts, (rng) => {
    const out: T[] = [];
    for (const cells of layout) {
      for (let i = 0; i < cells.length; i += 1) out.push(...(cells[rng.int(cells.length)] ?? []));
    }
    return out;
  }, stat);
}
