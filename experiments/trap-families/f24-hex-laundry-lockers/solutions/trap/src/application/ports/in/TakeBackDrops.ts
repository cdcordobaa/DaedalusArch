import type { DropView } from './AcceptDrops';

/** What the laundry service does with laundry nobody collected. */
export interface TakeBackDrops {
  takeBack(dropId: string): DropView;
}
