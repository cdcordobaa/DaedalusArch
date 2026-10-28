export interface StartTripPort {
  start(riderId: string, scooterId: string): Promise<string>;
}
