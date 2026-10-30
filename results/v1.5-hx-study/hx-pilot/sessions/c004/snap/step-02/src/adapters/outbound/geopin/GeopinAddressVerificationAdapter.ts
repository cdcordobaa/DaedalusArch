import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import type { AddressVerification } from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { VerifiedAddress } from '../../../domain/model/VerifiedAddress';

const MIN_CONFIDENCE = 0.8;

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<VerifiedAddress | null> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) return { address: address.oneLine(), unverified: true };
      throw e;
    }
    const best = result.matches[0];
    if (!best) return null;
    if (best.precision !== 'ROOFTOP' && best.precision !== 'STREET') return null;
    if (!(best.confidence >= MIN_CONFIDENCE)) return null;
    return { address: best.formattedAddress, point: { latitude: best.location.lat, longitude: best.location.lng } };
  }
}
