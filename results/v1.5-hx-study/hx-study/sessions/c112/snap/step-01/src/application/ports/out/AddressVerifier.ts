import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address as the geocoder writes it, with the point to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point: GeoPoint;
}

export interface AddressVerifier {
  /** The best match precise enough to drive to, or null when there is none. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
