import { Day } from '../../shared-kernel/Day';
import type { LotShelf } from '../domain/lot/LotShelf';
import { Grams } from '../domain/lot/values/Grams';
import { requireLot } from './lookup';

/** Takes the portion out of the lot; `openSharedLot` opens the receiving garden's lot when the event is passed on. */
export function shareSeed(shelf: LotShelf, today: string, number: string, garden: string, grams: number): string {
  const lot = requireLot(shelf, number);
  const newLot = shelf.nextNumber();
  lot.shareOut(newLot, garden, Grams.of(grams), Day.parse(today));
  shelf.keep(lot);
  return newLot.text;
}
