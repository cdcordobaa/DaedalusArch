import type { LogEntry, SeedLot } from './SeedLot';
import type { LotNumber } from './values/LotNumber';

export interface LotShelf {
  nextNumber(): LotNumber;
  find(number: LotNumber): SeedLot | undefined;
  atGarden(garden: string): SeedLot[];
  /** The history of one lot, oldest first. */
  logOf(number: LotNumber): LogEntry[];
  /** Keeps the lot and the events it raised in one step. */
  keep(lot: SeedLot): void;
  /** Keeps several lots in one step: all of them or none. */
  keepAll(lots: SeedLot[]): void;
}
