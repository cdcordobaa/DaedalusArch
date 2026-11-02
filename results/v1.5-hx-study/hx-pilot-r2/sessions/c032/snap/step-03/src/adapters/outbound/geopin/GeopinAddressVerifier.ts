import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { AddressVerifierUnavailableError } from '../../../application/ports/out/AddressVerifier';
import type { AddressVerifier, AddressVerification } from '../../../application/ports/out/AddressVerifier';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

const MIN_CONFIDENCE = 0.8;

export class GeopinAddressVerifier implements AddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(address: DeliveryAddress): Promise<AddressVerification> {
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
    const notFound: AddressVerification = { ok: false, rejection: 'NOT_FOUND' };
    if (!best) return notFound;
    if (!(best.confidence >= MIN_CONFIDENCE)) return notFound;
    if (best.components.countryIso.trim().toUpperCase() !== address.country.trim().toUpperCase()) {
      return { ok: false, rejection: 'OTHER_COUNTRY' };
    }
    if (best.precision === 'LOCALITY' || best.precision === 'POSTCODE') {
      return { ok: false, rejection: 'STREET_MISSING' };
    }
    return {
      ok: true,
      address: { formatted: best.formattedAddress, point: { latitude: best.location.lat, longitude: best.location.lng } },
    };
  }
}
