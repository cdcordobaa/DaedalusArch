export interface DoorLatch {
  /** Pops the door of a bay in a building; true only when the hardware confirmed it opened. */
  open(buildingId: string, bay: number): boolean;
}
