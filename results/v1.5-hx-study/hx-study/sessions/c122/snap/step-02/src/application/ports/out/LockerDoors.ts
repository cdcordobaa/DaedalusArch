export interface LockerDoors {
  /** Pulse the locker's door open; true only when the hardware confirms it opened. */
  open(buildingId: string, bay: number): boolean;
}
