import type { GeoPoint } from '../../../domain/model/GeoPoint';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

/** How exactly a match pins the address down: a single building, a street, or only a wider area. */
export type MatchAccuracy = 'building' | 'street' | 'area';

/** The best match found for an address, in the application's own terms. */
export interface AddressMatch {
  readonly standardAddress: string;
  readonly accuracy: MatchAccuracy;
  readonly confidence: number;
  readonly point: GeoPoint;
}

export interface AddressVerification {
  /** The best match for the address, or undefined when nothing was found. */
  bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined>;
}
