import type { GeoPoint } from './GeoPoint';

/** How exactly an address was located, from most to least exact. */
export type LocationAccuracy = 'building' | 'street' | 'town' | 'postcode-area';

/** The best match a geocoder found for an address: its own spelling, how exact it is, and where it is. */
export interface GeocodedAddress {
  readonly formatted: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  readonly point: GeoPoint;
}
