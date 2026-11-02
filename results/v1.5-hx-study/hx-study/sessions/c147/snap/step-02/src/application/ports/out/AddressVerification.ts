import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Thrown when the verification provider cannot be reached. */
export class AddressVerificationUnavailableError extends Error {}

/** Finds the best match for an address, or undefined when nothing matches. */
export interface AddressVerification {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}
