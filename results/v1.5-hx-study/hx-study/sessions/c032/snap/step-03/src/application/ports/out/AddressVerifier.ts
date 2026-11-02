import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precise enough to drive to, as the geocoder writes it. */
export interface VerifiedAddress {
  readonly address: string;
  /** Absent when the geocoder was unavailable and the address is as the customer typed it. */
  readonly point?: GeoPoint;
  readonly unverified?: boolean;
}

export type RejectionCause = 'NOT_FOUND' | 'OTHER_COUNTRY' | 'STREET_MISSING';

/** An address the geocoder could not accept, and why. */
export interface RejectedAddress {
  readonly rejected: RejectionCause;
}

export interface AddressVerifier {
  /** Returns the verified address, a rejection saying what is wrong, or null when nothing was found. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | RejectedAddress | null>;
}
