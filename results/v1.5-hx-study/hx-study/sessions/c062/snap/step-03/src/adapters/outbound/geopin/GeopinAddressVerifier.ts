import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import type { AddressVerifier, RejectedAddress, VerifiedAddress } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

const MIN_CONFIDENCE = 0.8;

function reject(reason: string): RejectedAddress {
  return { rejected: true, reason };
}

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
      if (e instanceof GeopinUnavailableError) return { address: address.oneLine(), unverified: true };
      throw e;
    }
    const best = result.matches[0];
    if (!best || !(best.confidence >= MIN_CONFIDENCE)) return reject('We could not find this address.');
    if (best.components.countryIso.toUpperCase() !== address.country.toUpperCase()) {
      return reject('This address is in another country.');
    }
    if (best.precision !== 'ROOFTOP' && best.precision !== 'STREET') {
      return reject('Please add your street and house number.');
    }
    return { address: best.formattedAddress, point: { latitude: best.location.lat, longitude: best.location.lng } };
  }
}
