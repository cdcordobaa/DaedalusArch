import type { GeoPoint } from './GeoPoint';

/** How exactly an address was located: down to the building, the street, or only a wider area. */
export type LocationAccuracy = 'building' | 'street' | 'area';

/** An address as the geocoder wrote it, with how well it matched what was typed. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  /** Two-letter code of the country the geocoder placed the address in. */
  readonly country: string;
  readonly point: GeoPoint;
}
