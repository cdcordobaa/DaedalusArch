import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Finds the best match for an address, or undefined when there is none. */
export interface AddressGeocoder {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}
