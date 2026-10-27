import { CellarRefusal } from '../domain/CellarRefusal';
import type { BatchStore } from '../domain/batch/BatchStore';
import { usageNewestFirst } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { kgFromGrams } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';

export function readings(deps: { readonly lots: LotStore; readonly batches: BatchStore }) {
  return {
    lotStock: (lotId: string): number => kgFromGrams(lotOrRefuse(deps.lots, lotId).gramsLeft),
    batchStatus(batchId: string): string {
      const batch = deps.batches.lookup(batchId);
      if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
      return batch.status;
    },
    lotUsage: (lotId: string): { batchId: string; kg: number }[] =>
      usageNewestFirst(lotOrRefuse(deps.lots, lotId)).map((d) => ({ batchId: d.batchId, kg: kgFromGrams(d.grams) })),
  };
}
