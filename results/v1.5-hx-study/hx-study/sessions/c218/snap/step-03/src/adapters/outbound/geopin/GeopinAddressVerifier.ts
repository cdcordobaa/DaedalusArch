import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import {
  ADDRESS_NEEDS_STREET,
  ADDRESS_NOT_FOUND,
  ADDRESS_OTHER_COUNTRY,
  type AddressVerifier,
  type RejectedAddress,
  type VerifiedAddress,
} from '../../../application/ports/out/AddressVerifier';

const MIN_CONFIDENCE = 0.8;

export class GeopinAddressVerifier implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | RejectedAddress> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) return { address: address.oneLine(), point: null };
      throw e;
    }
    const reject = (reason: string): RejectedAddress => ({ rejected: true, reason });
    const best = result.matches[0];
    if (!best) return reject(ADDRESS_NOT_FOUND);
    if (!(best.confidence >= MIN_CONFIDENCE)) return reject(ADDRESS_NOT_FOUND);
    if (best.components.countryIso.trim().toUpperCase() !== address.country.trim().toUpperCase()) {
      return reject(ADDRESS_OTHER_COUNTRY);
    }
    if (best.precision === 'LOCALITY' || best.precision === 'POSTCODE') return reject(ADDRESS_NEEDS_STREET);
    if (best.precision !== 'ROOFTOP' && best.precision !== 'STREET') return reject(ADDRESS_NOT_FOUND);
    return { address: best.formattedAddress, point: { latitude: best.location.lat, longitude: best.location.lng } };
  }
}
