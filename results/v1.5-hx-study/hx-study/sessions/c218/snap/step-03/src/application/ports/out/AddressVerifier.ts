import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeoPoint } from '../../../domain/model/GeoPoint';

export interface VerifiedAddress {
  /** The address as the geocoder writes it. */
  readonly address: string;
  /** Null when the geocoder was unavailable and the address is unverified. */
  readonly point: GeoPoint | null;
}

export interface RejectedAddress {
  readonly rejected: true;
  /** What the customer must fix. */
  readonly reason: string;
}

export const ADDRESS_NOT_FOUND = 'We could not find this address.';
export const ADDRESS_OTHER_COUNTRY = 'This address is in another country.';
export const ADDRESS_NEEDS_STREET = 'Please add your street and house number.';

/** Finds the address a driver can navigate to, or a rejection explaining what to fix. */
export interface AddressVerifier {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | RejectedAddress>;
}
