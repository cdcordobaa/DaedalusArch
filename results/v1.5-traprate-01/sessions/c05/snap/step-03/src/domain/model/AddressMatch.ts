import type { GeoPoint } from './GeoPoint';

/** The best match an address lookup found for a typed address. */
export interface AddressMatch {
  readonly address: string;
  readonly point: GeoPoint;
  readonly precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
  readonly confidence: number;
  /** Two-letter code of the country the match lies in. */
  readonly country: string;
}
