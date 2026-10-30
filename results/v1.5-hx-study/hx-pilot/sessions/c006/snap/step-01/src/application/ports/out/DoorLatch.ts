export interface DoorLatch {
  /** Pops the door of a locker bay; true only when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
