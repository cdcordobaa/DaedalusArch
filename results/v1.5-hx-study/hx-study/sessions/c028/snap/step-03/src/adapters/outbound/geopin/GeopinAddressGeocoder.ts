import type { GeopinClient, GeopinMatch } from 'geopin-sdk';
import type { AddressGeocoder } from '../../../application/ports/out/AddressGeocoder';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';
import type { GeocodedAddress, LocationPrecision } from '../../../domain/model/GeocodedAddress';

function precisionOf(p: GeopinMatch['precision']): LocationPrecision {
  if (p === 'ROOFTOP') return 'rooftop';
  if (p === 'STREET') return 'street';
  return 'area';
}

export class GeopinAddressGeocoder implements AddressGeocoder {
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
      point: { latitude: m.location.lat, longitude: m.location.lng },
      precision: precisionOf(m.precision),
      confidence: m.confidence,
      country: m.components.countryIso.toUpperCase(),
    };
  }
}
