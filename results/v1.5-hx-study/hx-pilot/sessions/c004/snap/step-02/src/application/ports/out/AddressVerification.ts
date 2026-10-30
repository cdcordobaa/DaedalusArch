import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

/** Finds the address a customer typed on the map; null when no match is precise enough to drive to. */
export interface AddressVerification {
  verify(address: DeliveryAddress): Promise<VerifiedAddress | null>;
}
