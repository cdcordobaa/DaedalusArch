/** What sign-ups need to know about shifts. */
export interface ShiftDirectory {
  exists(shiftId: string): boolean;
  isCancelled(shiftId: string): boolean;
  holdPlaces(shiftId: string, holder: string, places: number): void;
  releasePlaces(shiftId: string, holder: string): void;
}
