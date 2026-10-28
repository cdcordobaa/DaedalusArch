import { CellarRefusal } from '../domain/CellarRefusal';
import type { BatchStore } from '../domain/batch/BatchStore';
import type { LotStore } from '../domain/lot/LotStore';
import { kgFromGrams } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';
import type { LotUsageBook } from './ports';

export function readings(deps: { readonly lots: LotStore; readonly batches: BatchStore; readonly usage: LotUsageBook }) {
  return {
    /** Every brew that used the lot, newest first. Write-offs are not listed. */
    lotUsage(lotId: string): { batchId: string; kg: number }[] {
      lotOrRefuse(deps.lots, lotId);
      return deps.usage
        .entriesFor(lotId)
        .reverse()
        .map((entry) => ({ batchId: entry.batchId, kg: kgFromGrams(entry.grams) }));
    },
    lotStock: (lotId: string): number => kgFromGrams(lotOrRefuse(deps.lots, lotId).gramsLeft),
    batchStatus(batchId: string): string {
      const batch = deps.batches.lookup(batchId);
      if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
      return batch.status;
    },
  };
}
