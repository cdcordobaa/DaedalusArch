import type { GeopinClient, GeopinMatch } from 'geopin-sdk';
import type { AddressGeocoder } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress, LocationAccuracy } from '../../../domain/model/GeocodedAddress';

const ACCURACY: Record<GeopinMatch['precision'], LocationAccuracy> = {
  ROOFTOP: 'building',
  STREET: 'street',
  LOCALITY: 'town',
  POSTCODE: 'postcode-area',
};

export class GeopinAddressGeocoder implements AddressGeocoder {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const match = result.matches[0];
    if (!match) return null;
    return {
      formatted: match.formattedAddress,
      accuracy: ACCURACY[match.precision],
      confidence: match.confidence,
      point: { latitude: match.location.lat, longitude: match.location.lng },
    };
  }
}
