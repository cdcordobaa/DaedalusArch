import type { GeoPoint } from '../../../domain/model/GeoPoint';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export interface GeocodedAddress {
  readonly formattedAddress: string;
  readonly precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
  readonly confidence: number;
  readonly point: GeoPoint;
}

/** Thrown by an AddressGeocoder when the geocoding provider is down or unreachable. */
export class GeocoderUnavailableError extends Error {}

export interface AddressGeocoder {
  /** The best match for the address, or undefined when there is none. */
  best(address: DeliveryAddress): Promise<GeocodedAddress | undefined>;
}
