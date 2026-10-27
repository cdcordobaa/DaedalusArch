/** What sign-ups need to know about shifts. */
export interface ShiftDirectory {
  exists(shiftId: string): boolean;
}
