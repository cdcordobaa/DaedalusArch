import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precisely enough to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point: GeoPoint;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when no precise enough match exists. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
