import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address as the geocoder writes it, with the point to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  /** Null when Geopin was unavailable and the address is as the customer typed it. */
  readonly point: GeoPoint | null;
  readonly unverified: boolean;
}

export type RejectionReason = 'OTHER_COUNTRY' | 'STREET_MISSING' | 'NOT_FOUND';

export interface AddressRejection {
  readonly rejected: true;
  readonly reason: RejectionReason;
}

export interface AddressVerifier {
  /** The best match precise enough to drive to, or the reason there is none. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | AddressRejection>;
}
