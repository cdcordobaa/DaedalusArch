import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

/** Thrown by an implementation when the lookup service cannot be reached. */
export class AddressVerifierUnavailableError extends Error {}

/** Looks an address up and returns the best match, or undefined when there is none. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | undefined>;
}
