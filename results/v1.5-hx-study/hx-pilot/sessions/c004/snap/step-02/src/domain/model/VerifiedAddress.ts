import type { GeoPoint } from './GeoPoint';

/** A delivery address in its canonical spelling, with the point to drive to. */
export interface VerifiedAddress {
  readonly address: string;
  readonly point?: GeoPoint;
  /** True when Geopin could not check the address, so there is no point. */
  readonly unverified?: boolean;
}
