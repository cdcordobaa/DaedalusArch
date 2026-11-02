/** Opens a locker's door. */
export interface DoorLatch {
  /** True when the door opened. */
  open(buildingId: string, bay: number): boolean;
}
