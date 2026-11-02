import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import {
  AddressVerifierUnavailableError,
  type AddressProblem,
  type AddressVerifier,
  type VerifiedAddress,
} from '../../../application/ports/out/AddressVerifier';
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
    let problem: AddressProblem = 'none';
    if (best.confidence < MIN_CONFIDENCE) problem = 'not-found';
    else if (best.components.countryIso.trim().toUpperCase() !== address.country.trim().toUpperCase())
      problem = 'other-country';
    else if (best.precision !== 'ROOFTOP' && best.precision !== 'STREET') problem = 'street-missing';
    return {
      problem,
      formatted: best.formattedAddress,
      point: { latitude: best.location.lat, longitude: best.location.lng },
      drivable: problem === 'none',
    };
  }
}
