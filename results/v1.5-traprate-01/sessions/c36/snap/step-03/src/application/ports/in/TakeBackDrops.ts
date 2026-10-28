import type { DropView } from './AcceptDrops';

/** What the van driver does with laundry nobody collected: take it back to the shop. */
export interface TakeBackDrops {
  takeBack(dropId: string): DropView;
}
