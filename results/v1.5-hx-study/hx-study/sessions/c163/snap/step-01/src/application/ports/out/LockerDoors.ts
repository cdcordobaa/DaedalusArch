export interface LockerDoors {
  /** Pop the door of a bay in a building's locker bank; true only when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
