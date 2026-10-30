export interface FolioPort {
  charge(reservationId: string, cents: number, reason: string): Promise<void>;
}
