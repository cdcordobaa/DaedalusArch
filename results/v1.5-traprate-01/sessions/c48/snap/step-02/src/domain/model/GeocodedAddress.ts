import type { GeoPoint } from './GeoPoint';

/** The best match a geocoder found for a typed address. */
export interface GeocodedAddress {
  readonly address: string;
  readonly point: GeoPoint;
  readonly precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
  readonly confidence: number;
}
