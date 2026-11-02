/** Opens a locker's door. */
export interface LockerDoors {
  /** Pulses the bay's latch open; true only when the hardware confirmed the door opened. */
  open(buildingId: string, bay: number): boolean;
}
