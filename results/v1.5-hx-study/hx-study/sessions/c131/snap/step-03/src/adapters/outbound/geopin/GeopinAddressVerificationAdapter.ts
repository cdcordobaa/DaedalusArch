import type { GeopinClient, GeopinMatch } from 'geopin-sdk';
import type { AddressVerification, VerifiedAddress } from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { LocationAccuracy } from '../../../domain/model/LocationAccuracy';

function toAccuracy(precision: GeopinMatch['precision']): LocationAccuracy {
  switch (precision) {
    case 'ROOFTOP':
      return 'building';
    case 'STREET':
      return 'street';
    default:
      return 'area';
  }
}

export class GeopinAddressVerificationAdapter implements AddressVerification {
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
      accuracy: toAccuracy(best.precision),
      confidence: best.confidence,
      country: best.components.countryIso,
      point: { latitude: best.location.lat, longitude: best.location.lng },
    };
  }
}
