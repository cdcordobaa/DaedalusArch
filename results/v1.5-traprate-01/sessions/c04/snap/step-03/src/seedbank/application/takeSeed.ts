import type { LotShelf } from '../domain/lot/LotShelf';
import { Grams } from '../domain/lot/values/Grams';
import { requireLot } from './lookup';

export function takeSeed(shelf: LotShelf, number: string, grams: number): void {
  const lot = requireLot(shelf, number);
  lot.handOut(Grams.of(grams));
  shelf.keep(lot);
}
