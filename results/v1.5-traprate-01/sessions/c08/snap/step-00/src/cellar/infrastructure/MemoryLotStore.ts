import type { Mailbox } from '../application/ports';
import { withoutRaised, type IngredientLot } from '../domain/lot/ingredientLot';
import type { LotStore } from '../domain/lot/LotStore';

/** Lots in memory. Keeping a lot posts its raised facts to the mailbox in the same step. */
export function memoryLotStore(mailbox: Mailbox): LotStore {
  const rows = new Map<string, IngredientLot>();
  let issued = 0;
  return {
    nextLotId: () => `L-${String((issued += 1)).padStart(4, '0')}`,
    lookup: (lotId) => rows.get(lotId),
    keep: (lot) => {
      rows.set(lot.id, withoutRaised(lot));
      mailbox.post(lot.raised);
    },
  };
}
