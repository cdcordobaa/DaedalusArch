import type { GeoPoint } from './GeoPoint';

/** How exactly a location pins down the address: a building, a street, or only a wider area. */
export type LocationAccuracy = 'building' | 'street' | 'area';

/** An address as the geocoder writes it, with how exactly and how surely it was found. */
export interface GeocodedAddress {
  readonly formatted: string;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
  /** Two-letter code of the country the geocoder placed the address in. */
  readonly country: string;
  readonly point: GeoPoint;
}
