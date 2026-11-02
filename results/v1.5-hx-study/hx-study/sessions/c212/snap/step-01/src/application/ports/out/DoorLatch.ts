export interface DoorLatch {
  /** Pulses the door of a bay in a building. True only when the door opened. */
  open(buildingId: string, bay: number, holdMs: number): boolean;
}
