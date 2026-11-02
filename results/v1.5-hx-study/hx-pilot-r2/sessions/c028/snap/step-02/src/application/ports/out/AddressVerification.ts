import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export type MatchPrecision = 'exact-building' | 'street-level' | 'area-only';

/** The best match found for an address, in the application's own terms. */
export interface AddressMatch {
  readonly standardAddress: string;
  readonly precision: MatchPrecision;
  readonly confidence: number;
  readonly point: GeoPoint;
}

/** Thrown when the verification service cannot be reached. */
export class AddressVerificationUnavailableError extends Error {}

/**
 * Looks an address up; resolves to the best match, or null when nothing was found.
 * Throws AddressVerificationUnavailableError when the service is down.
 */
export interface AddressVerification {
  bestMatch(address: DeliveryAddress): Promise<AddressMatch | null>;
}
