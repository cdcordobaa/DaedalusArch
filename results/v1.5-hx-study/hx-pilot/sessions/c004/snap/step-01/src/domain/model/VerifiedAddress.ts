import type { GeoPoint } from './GeoPoint';

/** A delivery address in its canonical spelling, with the point to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point: GeoPoint;
}
