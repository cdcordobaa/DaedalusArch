import type { CellarEvent } from '../domain/events';
import type { LotUsageBook } from './ports';

/** Reaction to a kept brew: notes which batch used the lot. */
export const logLotUse = (book: LotUsageBook) => (fact: CellarEvent): void => {
  if (fact.kind !== 'lot-used') return;
  book.add(fact.lotId, fact.batchId, fact.grams);
};
