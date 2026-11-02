import type { GeopinClient } from 'geopin-sdk';
import type { AddressVerifier } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

export class GeopinAddressVerifierAdapter implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      formattedAddress: m.formattedAddress,
      precision: m.precision,
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
