import type { GeoPoint } from './GeoPoint';

/** How closely a located address pins down the delivery point. */
export type LocationAccuracy = 'building' | 'street' | 'area';

/** An address as the geocoder writes it, with where it is and how sure the geocoder is. */
export interface GeocodedAddress {
  readonly formatted: string;
  readonly point: GeoPoint;
  readonly accuracy: LocationAccuracy;
  readonly confidence: number;
}
