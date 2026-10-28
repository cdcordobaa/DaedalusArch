import { CellarRefusal } from '../domain/CellarRefusal';
import { planBatch, startFermenting } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';
import { useInBrew } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { gramsFromKg } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';

export interface LotUse {
  readonly lotId: string;
  readonly kg: number;
}

export function batchCommands(deps: { readonly batches: BatchStore; readonly lots: LotStore; readonly today: () => string }) {
  return {
    plan(beer: string, fermentationDays: number): string {
      const batch = planBatch(deps.batches.nextBatchId(), beer, fermentationDays);
      deps.batches.record(batch);
      return batch.id;
    },
    brew(batchId: string, uses: readonly LotUse[]): void {
      const batch = deps.batches.lookup(batchId);
      if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
      if (batch.status !== 'planned') throw new CellarRefusal(`batch ${batchId} is already brewed`);
      if (uses.length === 0) throw new CellarRefusal('a brew must use at least one lot');
      const seen = new Set<string>();
      for (const { lotId } of uses) {
        if (seen.has(lotId)) throw new CellarRefusal(`lot ${lotId} is listed twice`);
        seen.add(lotId);
      }
      const today = deps.today();
      // Check every use first; nothing is kept until all of them are accepted.
      const taken = uses.map(({ lotId, kg }) => useInBrew(lotOrRefuse(deps.lots, lotId), gramsFromKg(kg), today));
      const brewed = startFermenting(batch, today);
      for (const lot of taken) deps.lots.keep(lot);
      deps.batches.record(brewed);
    },
  };
}
