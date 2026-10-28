/** What reservations need to know about car parks. */
export interface CarParkDirectory {
  exists(carParkId: string): boolean;
  /** Takes the bays for the holder if enough are free; false (and nothing taken) otherwise. */
  takeBays(carParkId: string, holder: string, bays: number): boolean;
}
