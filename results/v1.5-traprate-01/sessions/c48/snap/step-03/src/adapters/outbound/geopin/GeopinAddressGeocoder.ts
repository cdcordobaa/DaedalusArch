import { GeopinUnavailableError, type GeopinClient } from 'geopin-sdk';
import { GeocoderUnavailableError, type AddressGeocoder } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress } from '../../../domain/model/GeocodedAddress';

export class GeopinAddressGeocoder implements AddressGeocoder {
  constructor(private readonly client: GeopinClient) {}

  async geocode(address: DeliveryAddress): Promise<GeocodedAddress | undefined> {
    let result;
    try {
      result = await this.client.geocode({
        query: { addressLine: address.street, postalCode: address.postcode, locality: address.city },
        countryIso: address.country,
      });
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new GeocoderUnavailableError();
      throw e;
    }
    const best = result.matches[0];
    if (!best) return undefined;
    return {
      address: best.formattedAddress,
      point: { latitude: best.location.lat, longitude: best.location.lng },
      precision: best.precision,
      confidence: best.confidence,
      country: best.components.countryIso.toUpperCase(),
    };
  }
}
