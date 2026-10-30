import type { GeoPoint } from './GeoPoint';

/** How exactly a verified address pins down a place. */
export type AddressPrecision = 'rooftop' | 'street' | 'coarse';

/** An address as the geocoder writes it, with where it is and how sure the geocoder is. */
export interface VerifiedAddress {
  readonly formatted: string;
  readonly point: GeoPoint;
  readonly precision: AddressPrecision;
  readonly confidence: number;
  /** Two-letter code of the country the geocoder placed the address in. */
  readonly country: string;
}
