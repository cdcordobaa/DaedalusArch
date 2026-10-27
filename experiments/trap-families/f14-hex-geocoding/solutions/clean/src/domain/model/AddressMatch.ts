import type { GeoPoint } from './GeoPoint';

/** How closely a found place pins the address: the building itself, only the street, or only the town or postcode area. */
export type MatchLevel = 'building' | 'street' | 'area';

/** A place the address lookup found for an address, best first. */
export interface AddressMatch {
  /** The address as the lookup writes it. */
  readonly label: string;
  readonly point: GeoPoint;
  readonly country: string;
  readonly level: MatchLevel;
  /** From 0 to 1: how sure the lookup is that this place is the address. */
  readonly confidence: number;
}
