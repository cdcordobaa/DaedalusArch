import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

/** Finds the best match for an address the customer typed, or null when there is none. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}

/** Thrown by a verifier when the address service cannot be reached or does not answer. */
export class AddressVerifierUnavailableError extends Error {
  constructor(message = 'Address verification is unavailable') {
    super(message);
    this.name = 'AddressVerifierUnavailableError';
  }
}
