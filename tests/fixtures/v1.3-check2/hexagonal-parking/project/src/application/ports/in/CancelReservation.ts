export interface CancelReservation {
  cancel(reservationId: string): Promise<void>;
}
