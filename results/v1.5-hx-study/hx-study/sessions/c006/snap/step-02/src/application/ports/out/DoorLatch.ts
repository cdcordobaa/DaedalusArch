export interface DoorLatch {
  /** Pops the door of a locker bay in a building; true only when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
