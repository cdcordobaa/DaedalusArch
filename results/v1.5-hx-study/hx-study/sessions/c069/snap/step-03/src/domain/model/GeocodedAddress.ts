import type { GeoPoint } from './GeoPoint';

/** How exactly an address was located: at a building, along a street, or only as an area. */
export type LocationAccuracy = 'building' | 'street' | 'area';

/** The best match an address lookup found: the address as written by the geocoder and where it is. */
export interface GeocodedAddress {
  readonly canonicalAddress: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  /** Two-letter code of the country the match lies in. */
  readonly country: string;
  readonly point: GeoPoint;
}
