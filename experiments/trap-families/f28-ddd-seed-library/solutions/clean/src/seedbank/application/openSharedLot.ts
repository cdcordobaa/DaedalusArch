import type { LibraryEvent } from '../../shared-kernel/LibraryEvent';
import type { PortionShared } from '../domain/lot/events/PortionShared';
import type { LotShelf } from '../domain/lot/LotShelf';
import { SeedLot } from '../domain/lot/SeedLot';
import { LotNumber } from '../domain/lot/values/LotNumber';

/** Opens the receiving garden's lot once per share, however often the event arrives. */
export function openSharedLot(shelf: LotShelf, event: LibraryEvent): void {
  const shared = event as PortionShared;
  if (shelf.find(LotNumber.of(shared.newLot)) !== undefined) return;
  shelf.keep(SeedLot.receivePortion(shared));
}
