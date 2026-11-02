export interface LockerDoors {
  /** Pops the locker's door; true only when the hardware confirms it opened. */
  open(buildingId: string, bay: number): boolean;
}
