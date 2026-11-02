import type { GeoPoint } from './GeoPoint';

/** How closely a resolved address pins down a place: a building, a street, or only a wider area. */
export type LocationPrecision = 'building' | 'street' | 'area';

/** An address as the geocoder resolved it: the standard spelling, the point, and how sure it is. */
export interface GeocodedAddress {
  readonly standardSpelling: string;
  readonly precision: LocationPrecision;
  readonly confidence: number;
  /** Two-letter code of the country the geocoder placed the match in. */
  readonly country: string;
  readonly point: GeoPoint;
}
