export type BookingState = 'BKG_CONFIRMED' | 'BKG_PENDING' | 'BKG_ON_HOLD' | 'BKG_REJECTED';
export type HoldCode = 'H10' | 'H22' | 'H31' | 'H47';

export interface BookingRequest {
  shipper_account: string;
  lane_code: string;
  pallet_count: number;
}

export interface BookingReply {
  booking_ref: string;
  booking_state: BookingState;
  hold_codes: HoldCode[];
  freight_charge: number;
  fuel_surcharge: number;
  confirmed_at: string;
  currency: string;
  weight: number;
  pallets: number;
}

export interface ShipmentWindow {
  earliest: string;
  latest: string;
}

export interface Lane {
  lane_code: string;
  origin: string;
  destination: string;
}

export class CarrierRefusal extends Error {
  refusal_code: HoldCode;
}

export class CargoLinkClient {
  constructor(options: { api_key: string });
  book(request: BookingRequest, window?: ShipmentWindow): Promise<BookingReply>;
  lanes(): Promise<Lane[]>;
}
