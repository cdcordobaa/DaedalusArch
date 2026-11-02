import type { Collected } from './CollectDrops';

/** What the laundry's van driver does with laundry nobody collected. */
export interface TakeBackDrops {
  takeBack(dropId: string): Collected;
}
