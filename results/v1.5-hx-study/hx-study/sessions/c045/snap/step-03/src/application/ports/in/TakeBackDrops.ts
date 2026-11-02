import type { DropView } from './AcceptDrops';

/** What the laundry's van driver does with laundry nobody collected. */
export interface TakeBackDrops {
  takeBack(dropId: string): DropView;
}
