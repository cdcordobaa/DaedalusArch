import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { AddressVerifierUnavailableError } from '../../../application/ports/out/AddressVerifier';
import type { AddressVerifier, VerifiedAddress } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

const MIN_CONFIDENCE = 0.8;

export class GeopinAddressVerifier implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | null> {
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
    if (!best) return null;
    if (best.precision !== 'ROOFTOP' && best.precision !== 'STREET') return null;
    if (!(best.confidence >= MIN_CONFIDENCE)) return null;
    return { formatted: best.formattedAddress, point: { latitude: best.location.lat, longitude: best.location.lng } };
  }
}
