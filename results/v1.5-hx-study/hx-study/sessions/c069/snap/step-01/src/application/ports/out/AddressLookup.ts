import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Finds an address on the map; resolves to the best match, or undefined when there is none. */
export interface AddressLookup {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}
