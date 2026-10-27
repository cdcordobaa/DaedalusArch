import { GeopinUnavailableError, type GeopinClient, type GeopinMatch } from 'geopin-sdk';
import type { AddressLookup } from '../../../application/ports/out/AddressLookup';
import { AddressLookupUnavailable } from '../../../domain/errors/AddressLookupUnavailable';
import type { AddressMatch, MatchLevel } from '../../../domain/model/AddressMatch';
import type { DeliveryAddress } from '../../../domain/model/DeliveryAddress';

const LEVEL: Record<GeopinMatch['precision'], MatchLevel> = { ROOFTOP: 'building', STREET: 'street', LOCALITY: 'area', POSTCODE: 'area' };

export class GeopinAddressLookupAdapter implements AddressLookup {
  constructor(private readonly client: GeopinClient) {}

  async matchesFor(address: DeliveryAddress): Promise<AddressMatch[]> {
    try {
      const result = await this.client.geocode({ query: { addressLine: address.street, postalCode: address.postcode, locality: address.city }, countryIso: address.country });
      return result.matches.map((m) => ({
        label: m.formattedAddress,
        point: { latitude: m.location.lat, longitude: m.location.lng },
        country: m.components.countryIso,
        level: LEVEL[m.precision],
        confidence: m.confidence,
      }));
    } catch (e) {
      if (e instanceof GeopinUnavailableError) throw new AddressLookupUnavailable(e.message);
      throw e;
    }
  }
}
