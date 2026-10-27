import { CellarRefusal } from '../CellarRefusal';
import type { CellarEvent } from '../events';
import { daysAfter, isEarlier } from '../value-objects/calendar';

export type BatchStatus = 'planned' | 'fermenting' | 'bottled';

/** One run of one beer through the brewhouse. It is never bottled before its fermentation days have passed. */
export interface BrewBatch {
  readonly id: string;
  readonly beer: string;
  /** Minimum days the beer ferments before it may be bottled. */
  readonly fermentationDays: number;
  readonly status: BatchStatus;
  readonly brewedOn: string | null;
  readonly raised: readonly CellarEvent[];
}

export function planBatch(id: string, beer: string, fermentationDays: number): BrewBatch {
  if (beer.trim() === '') throw new CellarRefusal('a batch needs a beer name');
  if (!Number.isInteger(fermentationDays) || fermentationDays < 1) throw new CellarRefusal('fermentation days must be a whole number of at least 1');
  return { id, beer, fermentationDays, status: 'planned', brewedOn: null, raised: [] };
}

/** Starts fermenting and raises `batch-brewed`, which tells each lot what it gives. */
export function brew(batch: BrewBatch, draws: readonly { lotId: string; grams: number }[], day: string): BrewBatch {
  if (batch.status !== 'planned') throw new CellarRefusal(`batch ${batch.id} is already brewed`);
  if (draws.length === 0) throw new CellarRefusal('a brew needs at least one lot');
  const listed = new Set<string>();
  for (const draw of draws) {
    if (listed.has(draw.lotId)) throw new CellarRefusal(`lot ${draw.lotId} is listed twice`);
    listed.add(draw.lotId);
  }
  return { ...batch, status: 'fermenting', brewedOn: day, raised: [{ kind: 'batch-brewed', batchId: batch.id, draws: [...draws] }] };
}

export function bottle(batch: BrewBatch, day: string): BrewBatch {
  if (batch.status !== 'fermenting' || batch.brewedOn === null) throw new CellarRefusal(`batch ${batch.id} is not fermenting`);
  const from = daysAfter(batch.brewedOn, batch.fermentationDays);
  if (isEarlier(day, from)) throw new CellarRefusal(`batch ${batch.id} cannot be bottled before ${from}`);
  return { ...batch, status: 'bottled', raised: [] };
}

export const batchWithoutRaised = (batch: BrewBatch): BrewBatch => ({ ...batch, raised: [] });
