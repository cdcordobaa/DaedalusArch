import { Day } from '../../shared-kernel/Day';
import type { LotShelf } from '../domain/lot/LotShelf';
import { SeedLot } from '../domain/lot/SeedLot';
import { Germination } from '../domain/lot/values/Germination';
import { Grams } from '../domain/lot/values/Grams';

export interface DonateInput {
  readonly donor: string;
  readonly variety: string;
  readonly grams: number;
  readonly germination: number;
  readonly garden: string;
}

export function donateLot(shelf: LotShelf, today: string, input: DonateInput): string {
  const lot = SeedLot.donate(shelf.nextNumber(), {
    donor: input.donor, variety: input.variety, grams: Grams.of(input.grams),
    germination: Germination.of(input.germination), garden: input.garden, on: Day.parse(today),
  });
  shelf.keep(lot);
  return lot.number.text;
}
