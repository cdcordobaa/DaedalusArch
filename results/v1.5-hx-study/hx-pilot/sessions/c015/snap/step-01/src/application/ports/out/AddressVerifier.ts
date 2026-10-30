import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

/** Finds the best match for an address the customer typed, or null when there is none. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
