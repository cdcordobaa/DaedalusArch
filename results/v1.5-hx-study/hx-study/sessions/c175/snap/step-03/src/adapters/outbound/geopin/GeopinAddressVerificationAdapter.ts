import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import {
  AddressVerificationUnavailableError,
  type AddressMatch,
  type AddressVerification,
} from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new AddressVerificationUnavailableError(e.message);
      throw e;
    }
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      standardAddress: m.formattedAddress,
      accuracy: m.precision === 'ROOFTOP' ? 'building' : m.precision === 'STREET' ? 'street' : 'area',
      confidence: m.confidence,
      country: m.components.countryIso,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
