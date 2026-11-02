import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Resolves a typed address to the best match, or undefined when there is none. */
export interface AddressVerifier {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}

/** Thrown by an AddressVerifier when the verification service cannot be reached. */
export class AddressVerifierUnavailableError extends Error {}
