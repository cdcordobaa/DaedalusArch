import { DeliveryError } from './DeliveryError';

/** Addresses cannot be looked up right now. */
export class AddressLookupUnavailable extends DeliveryError {
  constructor(reason: string) {
    super(`address lookup unavailable: ${reason}`);
    this.name = 'AddressLookupUnavailable';
  }
}
