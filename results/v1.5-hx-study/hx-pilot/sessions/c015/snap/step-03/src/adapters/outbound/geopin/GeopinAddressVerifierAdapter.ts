import { GeopinUnavailableError, type GeopinClient, type GeopinMatch } from 'geopin-sdk';
import { AddressVerifierUnavailableError, type AddressVerifier } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { AddressPrecision, VerifiedAddress } from '../../../domain/model/VerifiedAddress';

function precisionOf(match: GeopinMatch): AddressPrecision {
  switch (match.precision) {
    case 'ROOFTOP':
      return 'rooftop';
    case 'STREET':
      return 'street';
    default:
      return 'coarse';
  }
}

export class GeopinAddressVerifierAdapter implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | null> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (error) {
      if (error instanceof GeopinUnavailableError) throw new AddressVerifierUnavailableError();
      throw error;
    }
    const best = result.matches[0];
    if (!best) return null;
    return {
      formatted: best.formattedAddress,
      point: { latitude: best.location.lat, longitude: best.location.lng },
      precision: precisionOf(best),
      confidence: best.confidence,
      country: best.components.countryIso.toUpperCase(),
    };
  }
}
