export interface Collected {
  readonly dropId: string;
  readonly lockerId: string;
  readonly bay: number;
}

/** What a resident does at the keypad: type the pickup code. */
export interface CollectDrops {
  pickup(buildingId: string, code: string): Collected;
}

/** What the laundry's van driver does with laundry nobody collected. */
export interface TakeBackDrops {
  takeBack(dropId: string): Collected;
}
