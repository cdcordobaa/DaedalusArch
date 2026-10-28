import type { LotShelf } from '../domain/lot/LotShelf';
import type { SeedLot } from '../domain/lot/SeedLot';
import { LotNumber } from '../domain/lot/values/LotNumber';
import { LibraryRefusal } from '../domain/LibraryRefusal';

export function requireLot(shelf: LotShelf, number: string): SeedLot {
  const lot = shelf.find(LotNumber.of(number));
  if (lot === undefined) throw new LibraryRefusal(`no lot ${number}`);
  return lot;
}
