import type { GeoPoint } from '../../../domain/model/GeoPoint';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** An address confirmed precisely enough to drive to, spelled the canonical way. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point?: GeoPoint;
  /** True when the address could not be checked because the verifier was unavailable. */
  readonly unverified?: boolean;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when no precise enough match exists. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
