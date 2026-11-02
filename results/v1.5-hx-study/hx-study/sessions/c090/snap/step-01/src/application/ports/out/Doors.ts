/** The locker doors: pops a compartment's latch. */
export interface Doors {
  /** True only when the door confirmed it opened. */
  open(buildingId: string, bay: number): boolean;
}
