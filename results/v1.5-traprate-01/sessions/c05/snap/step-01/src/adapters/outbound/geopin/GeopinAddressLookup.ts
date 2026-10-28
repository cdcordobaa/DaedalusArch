import type { GeopinClient } from 'geopin-sdk';
import type { AddressLookup } from '../../../application/ports/out/AddressLookup';
import type { AddressMatch } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressLookup implements AddressLookup {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      address: m.formattedAddress,
      point: { latitude: m.location.lat, longitude: m.location.lng },
      precision: m.precision,
      confidence: m.confidence,
    };
  }
}
