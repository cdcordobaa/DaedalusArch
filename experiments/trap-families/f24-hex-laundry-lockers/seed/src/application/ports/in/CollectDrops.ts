export interface Collected {
  readonly dropId: string;
  readonly lockerId: string;
  readonly bay: number;
}

/** What a resident does at the keypad: type the pickup code. */
export interface CollectDrops {
  pickup(buildingId: string, code: string): Collected;
}
