import type { LibraryEvent } from '../../shared-kernel/LibraryEvent';
import type { LotDonated } from '../domain/lot/events/LotDonated';
import type { Noticeboard } from './ports/Noticeboard';

export function thankDonor(board: Noticeboard, event: LibraryEvent): void {
  const donated = event as LotDonated;
  board.pin(`Thank you, ${donated.donor}, for ${String(donated.grams)} g of ${donated.variety} (${donated.lot}).`);
}
