import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export type AddressPrecision = 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';

/** The best match for an address, in the application's own terms. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly precision: AddressPrecision;
  readonly confidence: number;
  readonly point: GeoPoint;
  /** Two-letter code of the country the match lies in. */
  readonly country: string;
}

/** Thrown by a verifier when the verification service cannot be reached. */
export class AddressVerifierUnavailableError extends Error {}

export interface AddressVerifier {
  /** The best match for the address, or null when nothing was found. */
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
