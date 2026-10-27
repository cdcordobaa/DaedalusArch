/** What reservations need to know about car parks. */
export interface CarParkDirectory {
  exists(carParkId: string): boolean;
  isClosed(carParkId: string): boolean;
  holdBays(carParkId: string, holder: string, bays: number): void;
  releaseBays(carParkId: string, holder: string): void;
}
