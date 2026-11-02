/** Opens a locker's door. Returns true only when the door really opened. */
export interface LockerDoors {
  open(buildingId: string, bay: number): boolean;
}
