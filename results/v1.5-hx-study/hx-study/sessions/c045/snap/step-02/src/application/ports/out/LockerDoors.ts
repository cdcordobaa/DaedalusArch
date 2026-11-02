/** Opens a locker's door. Answers true only when the door actually opened. */
export interface LockerDoors {
  open(buildingId: string, bay: number): boolean;
}
