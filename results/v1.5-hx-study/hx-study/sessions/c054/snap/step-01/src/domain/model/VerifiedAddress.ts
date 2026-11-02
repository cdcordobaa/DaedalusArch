import type { GeoPoint } from './GeoPoint';

/** How exactly a verified address pins down a place. */
export type AddressPrecision = 'rooftop' | 'street' | 'area';

/** An address as the geocoder confirms it, with where it is. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly point: GeoPoint;
  readonly precision: AddressPrecision;
  readonly confidence: number;
}
