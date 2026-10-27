import { CellarRefusal } from '../CellarRefusal';
import type { CellarEvent } from '../events';

export type BatchStatus = 'planned' | 'fermenting' | 'bottled';

/** One run of one beer through the brewhouse. */
export interface BrewBatch {
  readonly id: string;
  readonly beer: string;
  /** Minimum days the beer ferments before it may be bottled. */
  readonly fermentationDays: number;
  readonly status: BatchStatus;
  readonly brewedOn?: string;
  readonly raised: readonly CellarEvent[];
}

export function planBatch(id: string, beer: string, fermentationDays: number): BrewBatch {
  if (beer.trim() === '') throw new CellarRefusal('a batch needs a beer name');
  if (!Number.isInteger(fermentationDays) || fermentationDays < 1) throw new CellarRefusal('fermentation days must be a whole number of at least 1');
  return { id, beer, fermentationDays, status: 'planned', raised: [] };
}

export function markBrewed(batch: BrewBatch, day: string): BrewBatch {
  if (batch.status !== 'planned') throw new CellarRefusal(`batch ${batch.id} is already brewed`);
  return { ...batch, status: 'fermenting', brewedOn: day };
}

export function markBottled(batch: BrewBatch): BrewBatch {
  if (batch.status !== 'fermenting') throw new CellarRefusal(`batch ${batch.id} is not fermenting`);
  return { ...batch, status: 'bottled' };
}

export const batchWithoutRaised = (batch: BrewBatch): BrewBatch => ({ ...batch, raised: [] });
