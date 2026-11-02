import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';
import type { LocationAccuracy } from '../../../domain/model/LocationAccuracy';

/** The best match found for an address, in the application's own terms. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  readonly country: string;
  readonly point: GeoPoint;
}

/** Looks an address up; resolves to null when nothing matches. */
export interface AddressVerification {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
