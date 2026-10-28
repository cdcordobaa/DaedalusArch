import { Day } from '../../shared-kernel/Day';
import type { LotShelf } from '../domain/lot/LotShelf';
import { Grams } from '../domain/lot/values/Grams';
import { requireLot } from './lookup';

/** Moves grams from a lot into a new lot at another garden; returns the new lot's number. */
export function shareLot(shelf: LotShelf, today: string, number: string, garden: string, grams: number): string {
  const lot = requireLot(shelf, number);
  const fresh = lot.shareOut(Grams.of(grams), garden, () => shelf.nextNumber(), Day.parse(today));
  shelf.keep(lot);
  shelf.keep(fresh);
  return fresh.number.text;
}
