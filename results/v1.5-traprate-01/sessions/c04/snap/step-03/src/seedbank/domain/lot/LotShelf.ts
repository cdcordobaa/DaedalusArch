import type { LogEntry, SeedLot } from './SeedLot';
import type { LotNumber } from './values/LotNumber';

export interface LotShelf {
  nextNumber(): LotNumber;
  find(number: LotNumber): SeedLot | undefined;
  atGarden(garden: string): SeedLot[];
  /** The lot's log, oldest first. */
  history(number: LotNumber): LogEntry[];
  /** Keeps the lot and the events it raised in one step. */
  keep(lot: SeedLot): void;
}
