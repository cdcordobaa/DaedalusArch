import { GeopinUnavailableError } from 'geopin-sdk';
import type { GeopinClient, GeopinMatch } from 'geopin-sdk';
import { AddressVerificationUnavailable } from '../../../application/ports/out/AddressVerification';
import type { AddressVerification } from '../../../application/ports/out/AddressVerification';
import type { AddressMatch, MatchAccuracy } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

const ACCURACY: Record<GeopinMatch['precision'], MatchAccuracy> = {
  ROOFTOP: 'building',
  STREET: 'street',
  LOCALITY: 'area',
  POSTCODE: 'area',
};

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<AddressMatch | undefined> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new AddressVerificationUnavailable(e.message);
      throw e;
    }
    const m = result.matches[0];
    if (m === undefined) return undefined;
    return {
      address: m.formattedAddress,
      accuracy: ACCURACY[m.precision],
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
