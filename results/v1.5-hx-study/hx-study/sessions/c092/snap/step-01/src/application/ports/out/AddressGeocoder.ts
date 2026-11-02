import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export type GeocodePrecision = 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';

export interface GeocodedAddress {
  readonly formattedAddress: string;
  readonly precision: GeocodePrecision;
  readonly confidence: number;
  readonly point: GeoPoint;
}

/** Looks an address up; resolves to the best match, or null when nothing matches. */
export interface AddressGeocoder {
  bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null>;
}
