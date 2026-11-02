import type { GeoPoint } from './GeoPoint';

/** How exactly a geocoder located an address. */
export type LocationPrecision = 'rooftop' | 'street' | 'area';

/** The best match a geocoder found for an address: its own spelling and the delivery point. */
export interface GeocodedAddress {
  readonly formatted: string;
  readonly point: GeoPoint;
  readonly precision: LocationPrecision;
  readonly confidence: number;
}
