import type { Mailbox } from '../application/ports';
import { batchWithoutRaised, type BrewBatch } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';

/** Batches in memory. Recording a batch posts its raised facts to the mailbox in the same step. */
export function memoryBatchStore(mailbox: Mailbox): BatchStore {
  const rows = new Map<string, BrewBatch>();
  const brewOrder: string[] = [];
  let issued = 0;
  return {
    nextBatchId: () => `B-${String((issued += 1)).padStart(4, '0')}`,
    lookup: (batchId) => rows.get(batchId),
    brewedNewestFirst: () => brewOrder.flatMap((id) => rows.get(id) ?? []).reverse(),
    record: (batch) => {
      if (batch.status !== 'planned' && !brewOrder.includes(batch.id)) brewOrder.push(batch.id);
      rows.set(batch.id, batchWithoutRaised(batch));
      mailbox.post(batch.raised);
    },
  };
}
