import type { GeopinClient, GeopinMatch } from 'geopin-sdk';
import type { AddressVerification } from '../../../application/ports/out/AddressVerification';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress, LocationAccuracy } from '../../../domain/model/GeocodedAddress';

const ACCURACY: Record<GeopinMatch['precision'], LocationAccuracy> = {
  ROOFTOP: 'building',
  STREET: 'street',
  LOCALITY: 'area',
  POSTCODE: 'area',
};

export class GeopinAddressVerificationAdapter implements AddressVerification {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return undefined;
    return {
      formatted: m.formattedAddress,
      accuracy: ACCURACY[m.precision],
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
