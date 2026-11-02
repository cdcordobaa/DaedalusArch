import type { GeoPoint } from './GeoPoint';

/** How exactly a match pins down the place: a building, a street, or only a wider area. */
export type MatchAccuracy = 'building' | 'street' | 'area';

/** An address as a geocoder resolved it: its own spelling, how exact it is, and where it is. */
export interface AddressMatch {
  readonly address: string;
  readonly accuracy: MatchAccuracy;
  readonly confidence: number;
  /** Two-letter code of the country the match lies in. */
  readonly country: string;
  readonly point: GeoPoint;
}
