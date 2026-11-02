import type { Collected } from './CollectDrops';

/** What the laundry's van driver does: take uncollected laundry back to the shop. */
export interface ReturnDrops {
  takeBack(dropId: string): Collected;
}
