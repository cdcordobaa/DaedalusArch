import type { Collected } from './CollectDrops';

/** What the laundry's van driver does with laundry nobody collected: take it back to the shop. */
export interface TakeBackDrops {
  takeBack(dropId: string): Collected;
}
