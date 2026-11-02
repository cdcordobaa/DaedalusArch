import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

/** An address confirmed precisely enough to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  /** Absent when Geopin was unavailable and the address is as typed. */
  readonly point?: GeoPoint;
  readonly unverified?: boolean;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when no precise enough match exists. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
