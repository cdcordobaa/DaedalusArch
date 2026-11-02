import type { DropView } from './AcceptDrops';

/** What the laundry does with laundry nobody collected: take it back to the shop. */
export interface ReturnDrops {
  takeBack(dropId: string): DropView;
}
