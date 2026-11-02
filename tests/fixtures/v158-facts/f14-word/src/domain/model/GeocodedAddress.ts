import type { GeoPoint } from './GeoPoint';

export type LocationPrecision = 'building' | 'street' | 'area';

export interface GeocodedAddress {
  readonly standardSpelling: string;
  readonly precision: LocationPrecision;
  readonly confidence: number;
  readonly point: GeoPoint;
}
