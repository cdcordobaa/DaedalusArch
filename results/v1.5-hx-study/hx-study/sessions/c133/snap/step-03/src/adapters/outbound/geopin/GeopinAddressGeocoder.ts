import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { GeocoderUnavailableError, type AddressGeocoder, type GeocodedAddress } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

export class GeopinAddressGeocoder implements AddressGeocoder {
  constructor(private readonly client: GeopinClient) {}

  async best(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
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
    if (!m) return undefined;
    return {
      formattedAddress: m.formattedAddress,
      precision: m.precision,
      confidence: m.confidence,
      countryIso: m.components.countryIso.toUpperCase(),
      point: { latitude: m.location.lat, longitude: m.location.lng },
    };
  }
}
