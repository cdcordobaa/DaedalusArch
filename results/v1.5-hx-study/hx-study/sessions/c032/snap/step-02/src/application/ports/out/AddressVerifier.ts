import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precise enough to drive to, as the geocoder writes it. */
export interface VerifiedAddress {
  readonly address: string;
  /** Absent when the geocoder was unavailable and the address is as the customer typed it. */
  readonly point?: GeoPoint;
  readonly unverified?: boolean;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when no precise enough match exists. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
