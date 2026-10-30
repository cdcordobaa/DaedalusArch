import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

/** Why an address cannot be driven to, so the customer knows what to fix. */
export interface AddressRejection {
  readonly rejected: 'NOT_FOUND' | 'OTHER_COUNTRY' | 'STREET_MISSING';
}

/** Finds the address a customer typed on the map; a rejection when no match is precise enough to drive to. */
export interface AddressVerification {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | AddressRejection>;
}
