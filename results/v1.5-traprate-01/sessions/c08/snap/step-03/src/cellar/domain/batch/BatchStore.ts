import type { BrewBatch } from './brewBatch';

export interface BatchStore {
  nextBatchId(): string;
  lookup(batchId: string): BrewBatch | undefined;
  /** Brewed batches, the most recently brewed first. */
  brewedNewestFirst(): BrewBatch[];
  /** Records the batch and posts the facts it raised, in one step. */
  record(batch: BrewBatch): void;
}
