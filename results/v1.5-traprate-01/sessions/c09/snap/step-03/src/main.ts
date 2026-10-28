import { Courier } from './seedbank/application/Courier';
import { donateLot } from './seedbank/application/donateLot';
import { shareSeed } from './seedbank/application/shareSeed';
import { takeSeed } from './seedbank/application/takeSeed';
import { thankDonor } from './seedbank/application/thankDonor';
import { lotLog, lotsAt, viewLot, type LotView } from './seedbank/application/viewLot';
import type { LogEntry } from './seedbank/domain/lot/SeedLot';
import { MemoryNoticeboard } from './seedbank/infrastructure/MemoryNoticeboard';
import { MemoryShelf } from './seedbank/infrastructure/MemoryShelf';

export interface LibraryOptions {
  /** Today as YYYY-MM-DD; the system date when left out. */
  readonly today?: () => string;
}

/** Composition root. Every request passes on the events it kept before it returns. */
export function createApp(options: LibraryOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const shelf = new MemoryShelf();
  const board = new MemoryNoticeboard();
  const courier = new Courier(shelf);
  courier.subscribe('lot-donated', (e) => thankDonor(board, e));

  const settled = <T>(result: T): T => {
    courier.flush();
    return result;
  };

  return {
    donate: (donor: string, variety: string, grams: number, germination: number, garden: string): string =>
      settled(donateLot(shelf, today(), { donor, variety, grams, germination, garden })),
    take: (lotNumber: string, grams: number): void => settled(takeSeed(shelf, lotNumber, grams)),
    share: (lotNumber: string, garden: string, grams: number): string =>
      settled(shareSeed(shelf, today(), lotNumber, garden, grams)),
    lot: (lotNumber: string): LotView => viewLot(shelf, lotNumber),
    lotLog: (lotNumber: string): LogEntry[] => lotLog(shelf, lotNumber),
    lotsAt: (garden: string): string[] => lotsAt(shelf, garden),
    thanks: (): string[] => board.notes(),
  };
}
