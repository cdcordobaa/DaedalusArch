export interface DoorOpener {
  /** Pop the door of a locker bay; true only when the hardware confirms it opened. */
  open(buildingId: string, bay: number): boolean;
}
