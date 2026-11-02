import type { GeoPoint } from '../../../domain/model/GeoPoint';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** An address confirmed precisely enough to drive to, spelled the canonical way. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point?: GeoPoint;
  /** True when the address could not be checked because the verifier was unavailable. */
  readonly unverified?: boolean;
}

/** Why an address was not accepted. */
export type AddressRejectionCode = 'NOT_FOUND' | 'WRONG_COUNTRY' | 'STREET_MISSING';

export interface AddressRejection {
  readonly rejected: AddressRejectionCode;
}

export interface AddressVerifier {
  /** Returns the verified address, or null when nothing confident enough was found, or a rejection with its cause. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | AddressRejection | null>;
}
