/** Opens a locker's door. */
export interface DoorLatch {
  /** Pulse the bay's latch open; true only when the hardware confirms the door opened. */
  open(buildingId: string, bay: number): boolean;
}
