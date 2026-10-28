import { planBatch } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';

export function batchCommands(deps: { readonly batches: BatchStore }) {
  return {
    plan(beer: string, fermentationDays: number): string {
      const batch = planBatch(deps.batches.nextBatchId(), beer, fermentationDays);
      deps.batches.record(batch);
      return batch.id;
    },
  };
}
