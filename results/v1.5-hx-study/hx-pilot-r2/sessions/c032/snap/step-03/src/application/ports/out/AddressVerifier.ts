import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export interface VerifiedAddress {
  /** The address as the geocoder writes it. */
  readonly formatted: string;
  readonly point: GeoPoint;
}

export type AddressRejection = 'NOT_FOUND' | 'OTHER_COUNTRY' | 'STREET_MISSING';

export type AddressVerification =
  | { readonly ok: true; readonly address: VerifiedAddress }
  | { readonly ok: false; readonly rejection: AddressRejection };

/** Thrown when the geocoding service cannot be reached or does not answer. */
export class AddressVerifierUnavailableError extends Error {}

/** Finds an address a driver can drive to, or says why there is none. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<AddressVerification>;
}
