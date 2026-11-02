/** Opens a locker's door; true only when the hardware confirms it opened. */
export interface Doors {
  open(buildingId: string, bay: number, holdMs: number): boolean;
}
