export interface LockerDoors {
  /** Pops the door of the given bay in the building; true only when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
