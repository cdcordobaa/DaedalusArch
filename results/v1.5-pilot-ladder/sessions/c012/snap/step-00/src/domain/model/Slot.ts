/** A free chair time; minutes is how long it lasts. */
export interface Slot {
  readonly slotId: string;
  readonly startsAt: string;
  readonly minutes: number;
}
