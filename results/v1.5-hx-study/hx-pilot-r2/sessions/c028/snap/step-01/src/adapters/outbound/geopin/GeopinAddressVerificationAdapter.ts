import type { GeopinClient } from 'geopin-sdk';
import type { AddressMatch, AddressVerification } from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<AddressMatch | null> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return null;
    return {
      standardAddress: m.formattedAddress,
      precision: m.precision === 'ROOFTOP' ? 'exact-building' : m.precision === 'STREET' ? 'street-level' : 'area-only',
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
