import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Finds the best match for an address; undefined when nothing matches. */
export interface AddressVerification {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}
