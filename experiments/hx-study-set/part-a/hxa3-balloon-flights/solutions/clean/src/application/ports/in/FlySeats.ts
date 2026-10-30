export interface SeatView {
  readonly flightId: string;
  readonly passenger: string;
  readonly status: string;
  readonly reason?: string;
  /** What is still to pay at boarding, in euros. */
  readonly due?: number;
}

export interface FlightView {
  readonly flightId: string;
  readonly day: string;
  readonly status: string;
}

export interface ManifestView {
  readonly flightId: string;
  readonly day: string;
  readonly passengers: readonly { passenger: string; status: string; voucherValue: number }[];
}

export interface FlySeats {
  schedule(flightId: string, day: string): Promise<FlightView>;
  requestSeat(flightId: string, passenger: string, voucherCode: string): Promise<SeatView>;
  board(flightId: string, passenger: string): Promise<SeatView>;
  manifest(flightId: string): Promise<ManifestView>;
}
