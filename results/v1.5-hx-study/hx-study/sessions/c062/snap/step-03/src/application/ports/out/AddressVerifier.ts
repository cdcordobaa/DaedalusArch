import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precisely enough to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  /** Absent when Geopin was unavailable and the address is as typed. */
  readonly point?: GeoPoint;
  readonly unverified?: boolean;
}

/** An address that cannot be used, with a reason the customer can act on. */
export interface RejectedAddress {
  readonly rejected: true;
  readonly reason: string;
}

export interface AddressVerifier {
  /** Returns the verified address, or a rejection saying what to fix. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | RejectedAddress>;
}
