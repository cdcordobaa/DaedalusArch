/** What other parts of the system may know about a reservation. */
export interface ReservationView {
  readonly id: string;
  readonly driver: string;
  readonly carParkId: string;
  readonly bays: number;
  readonly status: string;
}
