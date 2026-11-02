import type { AddressMatch } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** Thrown when the verification service cannot be reached or does not answer. */
export class AddressVerificationUnavailable extends Error {}

/** Looks an address up and returns the best match, or undefined when there is none. */
export interface AddressVerification {
  bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined>;
}
