import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

export class GeopinAddressVerifier implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new AddressVerifierUnavailableError(e.message);
      throw e;
    }
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      standardSpelling: m.formattedAddress,
      precision: m.precision === 'ROOFTOP' ? 'building' : m.precision === 'STREET' ? 'street' : 'area',
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
