import type { GeopinClient } from 'geopin-sdk';
import type { AddressGeocoder, GeocodedAddress } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressGeocoderAdapter implements AddressGeocoder {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null> {
    const result = await this.client.geocode({
      query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
      countryIso: address.country,
    });
    const m = result.matches[0];
    if (!m) return null;
    return {
      formattedAddress: m.formattedAddress,
      precision: m.precision,
      confidence: m.confidence,
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
