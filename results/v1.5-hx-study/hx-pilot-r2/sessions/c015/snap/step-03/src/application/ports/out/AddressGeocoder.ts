import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

/** Looks an address up; answers the best match, or null when nothing was found. */
export interface AddressGeocoder {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null>;
}

/** Thrown when the geocoding service cannot be reached or does not answer. */
export class GeocoderUnavailableError extends Error {}
