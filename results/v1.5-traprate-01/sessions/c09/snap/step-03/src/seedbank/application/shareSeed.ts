import { Day } from '../../shared-kernel/Day';
import type { LotShelf } from '../domain/lot/LotShelf';
import { Grams } from '../domain/lot/values/Grams';
import { requireLot } from './lookup';

export function shareSeed(shelf: LotShelf, today: string, number: string, garden: string, grams: number): string {
  const lot = requireLot(shelf, number);
  const shared = lot.shareTo(garden, Grams.of(grams), Day.parse(today), () => shelf.nextNumber());
  shelf.keepAll([lot, shared]);
  return shared.number.text;
}
