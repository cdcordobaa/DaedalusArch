import type { AddressMatch } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** Looks an address up and returns the best match, or undefined when there is none. */
export interface AddressVerification {
  bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined>;
}
