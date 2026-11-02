export interface LockerDoors {
  /** Pulse the locker's door latch; true only when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
