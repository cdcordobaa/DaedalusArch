import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { AddressVerificationUnavailableError, type AddressVerification } from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
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
      formatted: m.formattedAddress,
      point: { latitude: m.location.lat, longitude: m.location.lng },
      accuracy: m.precision === 'ROOFTOP' ? 'building' : m.precision === 'STREET' ? 'street' : 'area',
      confidence: m.confidence,
    };
  }
}
