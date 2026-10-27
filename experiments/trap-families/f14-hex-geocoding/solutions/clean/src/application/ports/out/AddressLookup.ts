import type { AddressMatch } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** The places that match an address, best first, in the application's own terms. */
export interface AddressLookup {
  matchesFor(address: DeliveryAddress): Promise<AddressMatch[]>;
}
