import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precise enough to drive to, as the geocoder writes it. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point: GeoPoint;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when no precise enough match exists. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
