/** Pops a locker's door; true only when the door actually opened. */
export interface LockerDoors {
  open(buildingId: string, bay: number): boolean;
}
