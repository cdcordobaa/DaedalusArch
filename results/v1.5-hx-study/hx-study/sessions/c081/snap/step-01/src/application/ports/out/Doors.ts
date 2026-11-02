export interface Doors {
  /** Pop a locker's door; true only when the hardware confirmed it opened. */
  open(buildingId: string, bay: number): boolean;
}
