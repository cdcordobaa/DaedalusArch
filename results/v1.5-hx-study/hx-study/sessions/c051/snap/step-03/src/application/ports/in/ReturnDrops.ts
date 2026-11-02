import type { Collected } from './CollectDrops';

/** What the laundry's van driver does with laundry nobody collected. */
export interface ReturnDrops {
  takeBack(dropId: string): Collected;
}
