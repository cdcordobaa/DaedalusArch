import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { AddressPrecision, VerifiedAddress } from '../../../domain/model/VerifiedAddress';

export class GeopinAddressVerifier implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | undefined> {
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
    const best = result.matches[0];
    if (!best) return undefined;
    const precision: AddressPrecision = best.precision === 'ROOFTOP' ? 'rooftop' : best.precision === 'STREET' ? 'street' : 'area';
    return {
      formatted: best.formattedAddress,
      point: { latitude: best.location.lat, longitude: best.location.lng },
      precision,
      confidence: best.confidence,
      country: best.components.countryIso.toUpperCase(),
    };
  }
}
