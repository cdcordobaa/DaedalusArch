import type { GeoPoint } from './GeoPoint';

/** The best match a geocoder found for an address. */
export interface GeocodedAddress {
  readonly formattedAddress: string;
  readonly precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
  readonly confidence: number;
  readonly point: GeoPoint;
}
