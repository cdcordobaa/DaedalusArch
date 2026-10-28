/** What reservations need to know about car parks. */
export interface CarParkDirectory {
  exists(carParkId: string): boolean;
  /** Takes the bays for a holder if they are all free; false otherwise. */
  takeBays(carParkId: string, holder: string, bays: number): boolean;
}
