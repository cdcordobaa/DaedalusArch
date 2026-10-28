import type { GeoPoint } from './GeoPoint';

/** The best match an address lookup found for a typed address. */
export interface AddressMatch {
  readonly address: string;
  readonly point: GeoPoint;
  readonly precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
  readonly confidence: number;
}
