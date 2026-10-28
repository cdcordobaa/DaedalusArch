import { CellarRefusal } from '../domain/CellarRefusal';
import type { BatchStore } from '../domain/batch/BatchStore';
import type { LotStore } from '../domain/lot/LotStore';
import { kgFromGrams } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';

export function readings(deps: { readonly lots: LotStore; readonly batches: BatchStore }) {
  return {
    lotStock: (lotId: string): number => kgFromGrams(lotOrRefuse(deps.lots, lotId).gramsLeft),
    lotUsage(lotId: string): { batchId: string; kg: number }[] {
      lotOrRefuse(deps.lots, lotId);
      return deps.batches.brewedNewestFirst().flatMap((batch) =>
        (batch.uses ?? []).filter((use) => use.lotId === lotId).map((use) => ({ batchId: batch.id, kg: use.kg })),
      );
    },
    batchStatus(batchId: string): string {
      const batch = deps.batches.lookup(batchId);
      if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
      return batch.status;
    },
  };
}
