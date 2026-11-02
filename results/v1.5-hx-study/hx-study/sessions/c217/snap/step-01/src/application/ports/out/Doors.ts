/** Pops a locker's door open. */
export interface Doors {
  /** True when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
