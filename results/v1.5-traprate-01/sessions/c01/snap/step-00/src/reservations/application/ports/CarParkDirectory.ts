/** What reservations need to know about car parks. */
export interface CarParkDirectory {
  exists(carParkId: string): boolean;
}
