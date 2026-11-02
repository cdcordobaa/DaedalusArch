import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { GeocoderUnavailableError, type AddressGeocoder, type GeocodedAddress } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressGeocoderAdapter implements AddressGeocoder {
  constructor(private readonly client: GeopinClient) {}

  async bestMatch(address: DeliveryAddress): Promise<GeocodedAddress | null> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new GeocoderUnavailableError(e.message);
      throw e;
    }
    const m = result.matches[0];
    if (!m) return null;
    return {
      formattedAddress: m.formattedAddress,
      precision: m.precision,
      confidence: m.confidence,
      countryCode: m.components.countryIso.toUpperCase(),
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
