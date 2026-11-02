import type { GeopinClient } from 'geopin-sdk';
import type { AddressLookup } from '../../../application/ports/out/AddressLookup';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

export class GeopinAddressLookup implements AddressLookup {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      canonicalAddress: m.formattedAddress,
      accuracy: m.precision === 'ROOFTOP' ? 'building' : m.precision === 'STREET' ? 'street' : 'area',
      confidence: m.confidence,
      country: m.components.countryIso,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
