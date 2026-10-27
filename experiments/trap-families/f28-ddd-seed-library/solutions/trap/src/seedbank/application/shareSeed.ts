import { Day } from '../../shared-kernel/Day';
import type { LotShelf } from '../domain/lot/LotShelf';
import { SeedLot } from '../domain/lot/SeedLot';
import { Grams } from '../domain/lot/values/Grams';
import { LibraryRefusal } from '../domain/LibraryRefusal';
import { requireLot } from './lookup';

export function shareSeed(shelf: LotShelf, today: string, number: string, garden: string, grams: number): string {
  const lot = requireLot(shelf, number);
  if (garden === lot.garden) throw new LibraryRefusal(`${number} is already at ${garden}`);
  if (lot.germination.percent < 70) throw new LibraryRefusal(`germination ${String(lot.germination.percent)}% is below 70%`);
  const day = Day.parse(today);
  if (day.daysSince(lot.intake) < 30) throw new LibraryRefusal(`lot ${number} is in quarantine until ${lot.intake.addDays(30).text}`);
  const newLot = shelf.nextNumber();
  lot.handOut(Grams.of(grams), 'shared-out', newLot.text);
  const portion = SeedLot.fromSnapshot({
    ...lot.snapshot(), number: newLot.text, garden, grams, intake: today, cameFrom: number,
    log: [{ entry: 'shared-in', grams, otherLot: number }],
  });
  shelf.keep(lot);
  shelf.keep(portion);
  return newLot.text;
}
