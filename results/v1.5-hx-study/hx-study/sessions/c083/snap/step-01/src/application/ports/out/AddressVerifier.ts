import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address as the geocoder writes it, with where it is and how precisely it was found. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly point: GeoPoint;
  /** True when the match is precise enough to drive to. */
  readonly drivable: boolean;
}

export interface AddressVerifier {
  /** The best match for the address, or null when nothing was found. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
