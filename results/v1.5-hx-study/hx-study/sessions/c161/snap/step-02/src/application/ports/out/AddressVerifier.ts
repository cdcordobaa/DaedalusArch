import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export interface VerifiedAddress {
  readonly address: string;
  readonly point?: GeoPoint;
  /** True when the address could not be checked (verifier unavailable). */
  readonly unverified?: boolean;
}

/** Resolves an address to a place precise enough to drive to, or null when there is none. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
