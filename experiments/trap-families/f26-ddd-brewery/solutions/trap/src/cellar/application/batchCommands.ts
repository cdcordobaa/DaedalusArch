import { CellarRefusal } from '../domain/CellarRefusal';
import { markBottled, markBrewed, planBatch } from '../domain/batch/brewBatch';
import type { BatchStore } from '../domain/batch/BatchStore';
import { takeFromLot } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';
import { gramsFromKg } from '../domain/value-objects/weight';
import { lotOrRefuse } from './lotCommands';

export function batchCommands(deps: { readonly batches: BatchStore; readonly lots: LotStore; readonly today: () => string }) {
  const find = (batchId: string) => {
    const batch = deps.batches.lookup(batchId);
    if (batch === undefined) throw new CellarRefusal(`no batch ${batchId}`);
    return batch;
  };
  return {
    plan(beer: string, fermentationDays: number): string {
      const batch = planBatch(deps.batches.nextBatchId(), beer, fermentationDays);
      deps.batches.record(batch);
      return batch.id;
    },
    brew(batchId: string, uses: { lotId: string; kg: number }[]): void {
      const day = deps.today();
      const brewed = markBrewed(find(batchId), day);
      if (uses.length === 0) throw new CellarRefusal('a brew needs at least one lot');
      if (new Set(uses.map((u) => u.lotId)).size !== uses.length) throw new CellarRefusal('the same lot is listed twice');
      const drawn = uses.map((u) => {
        const lot = lotOrRefuse(deps.lots, u.lotId);
        if (day > lot.bestBefore) throw new CellarRefusal(`lot ${lot.id} is past its best-before date ${lot.bestBefore}`);
        return takeFromLot(lot, gramsFromKg(u.kg), batchId);
      });
      for (const lot of drawn) deps.lots.keep(lot);
      deps.batches.record(brewed);
    },
    bottle(batchId: string): void {
      const batch = find(batchId);
      const bottled = markBottled(batch);
      const from = new Date(`${batch.brewedOn ?? ''}T00:00:00Z`);
      from.setUTCDate(from.getUTCDate() + batch.fermentationDays);
      const earliest = from.toISOString().slice(0, 10);
      if (deps.today() < earliest) throw new CellarRefusal(`batch ${batchId} cannot be bottled before ${earliest}`);
      deps.batches.record(bottled);
    },
  };
}
