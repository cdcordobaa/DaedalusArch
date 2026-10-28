import { CellarRefusal } from '../domain/CellarRefusal';
import { planBatch, startFermenting } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';
import { useInBrew, type IngredientLot } from '../domain/lot/ingredientLot';
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
    /** Checks everything first, then keeps all changes, so a refused brew changes nothing. */
    brew(batchId: string, uses: readonly LotUse[]): void {
      const today = deps.today();
      const planned = deps.batches.lookup(batchId);
      if (planned === undefined) throw new CellarRefusal(`no batch ${batchId}`);
      const brewed = startFermenting(planned, today);
      if (uses.length === 0) throw new CellarRefusal('a brew must use at least one lot');
      const seen = new Set<string>();
      for (const use of uses) {
        if (seen.has(use.lotId)) throw new CellarRefusal(`lot ${use.lotId} is listed twice`);
        seen.add(use.lotId);
      }
      const updated: IngredientLot[] = uses.map((use) => useInBrew(lotOrRefuse(deps.lots, use.lotId), gramsFromKg(use.kg), today));
      for (const lot of updated) deps.lots.keep(lot);
      deps.batches.record(brewed);
    },
  };
}
