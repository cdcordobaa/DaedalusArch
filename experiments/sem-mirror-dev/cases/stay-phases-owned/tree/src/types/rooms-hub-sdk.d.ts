declare module 'rooms-hub-sdk' {
  /** Reservation status codes of the RoomsHub channel manager. */
  export enum RhReservationStatus {
    PENDING_PAYMENT = 'PENDING_PAYMENT',
    CONFIRMED = 'CONFIRMED',
    CHECKED_IN = 'CHECKED_IN',
    CHECKED_OUT = 'CHECKED_OUT',
    CANCELLED = 'CANCELLED',
  }

  export interface RhReservation {
    reservation_id: string;
    status: RhReservationStatus;
    nightly_rate_cents: number;
  }

  export class RoomsHubClient {
    constructor(options: { api_key: string });
    reservation(id: string): Promise<RhReservation>;
  }
}
