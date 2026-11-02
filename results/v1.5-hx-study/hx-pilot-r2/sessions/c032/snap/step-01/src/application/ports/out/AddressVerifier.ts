import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export interface VerifiedAddress {
  /** The address as the geocoder writes it. */
  readonly formatted: string;
  readonly point: GeoPoint;
}

/** Finds an address a driver can drive to, or null when there is none precise enough. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
