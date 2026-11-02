import type { GeopinClient } from 'geopin-sdk';
import type { GeocodedAddress, LocationPrecision } from '../../../domain/model/GeocodedAddress';

const PRECISION: Record<string, LocationPrecision> = { ROOFTOP: 'building', STREET: 'street', LOCALITY: 'area', POSTCODE: 'area' };

export class GeopinAddressVerifier {
  constructor(private readonly client: GeopinClient) {}

  async verify(line: string, country: string): Promise<GeocodedAddress | undefined> {
    const r = await this.client.geocode({ query: { addressLine: line }, countryIso: country });
    const m = r.matches[0];
    if (m === undefined) return undefined;
    return { standardSpelling: m.formattedAddress, precision: PRECISION[m.precision] ?? 'area', confidence: m.confidence, point: { latitude: m.location.lat, longitude: m.location.lng } } as unknown as GeocodedAddress;
  }
}
