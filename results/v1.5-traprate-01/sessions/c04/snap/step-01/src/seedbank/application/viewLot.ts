import type { LotShelf } from '../domain/lot/LotShelf';
import type { LotSnapshot } from '../domain/lot/SeedLot';
import { requireLot } from './lookup';

export type LotView = LotSnapshot;

export function viewLot(shelf: LotShelf, number: string): LotView {
  return requireLot(shelf, number).snapshot();
}

export function lotsAt(shelf: LotShelf, garden: string): string[] {
  return shelf.atGarden(garden).map((lot) => lot.number.text);
}
