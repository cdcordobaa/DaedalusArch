import type { GeopinClient } from 'geopin-sdk';
import type { AddressVerifier, VerifiedAddress } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressVerifierAdapter implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | null> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const best = result.matches[0];
    if (!best) return null;
    return {
      formatted: best.formattedAddress,
      precision: best.precision,
      confidence: best.confidence,
      point: { latitude: best.location.lat, longitude: best.location.lng },
    };
  }
}
