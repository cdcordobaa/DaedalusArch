import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export interface VerifiedAddress {
  /** The address as the geocoder writes it. */
  readonly address: string;
  readonly point: GeoPoint;
}

/** Finds the address a driver can navigate to, or null when there is no precise enough match. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
