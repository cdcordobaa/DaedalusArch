declare module 'rooms-hub-sdk' {
  /** Reservation status codes of the RoomsHub channel manager. HELD: optional hold; CONF: confirmed; NOSHOW: guest did not arrive; CXL: cancelled; CXL_LATE: cancelled inside the property's window. */
  export enum RhReservationStatus {
    HELD = 'HELD',
    CONF = 'CONF',
    NOSHOW = 'NOSHOW',
    CXL = 'CXL',
    CXL_LATE = 'CXL_LATE',
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
