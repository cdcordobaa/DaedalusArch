import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export type GeocodePrecision = 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';

export interface GeocodedAddress {
  readonly formattedAddress: string;
  readonly precision: GeocodePrecision;
  readonly confidence: number;
  /** Two-letter code of the country the match lies in. */
  readonly countryCode: string;
  readonly point: GeoPoint;
}

/** Thrown by a geocoder when the geocoding service cannot be reached. */
export class GeocoderUnavailableError extends Error {}

/** Looks an address up; resolves to the best match, or null when nothing matches. */
export interface AddressGeocoder {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null>;
}
