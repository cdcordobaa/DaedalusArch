import type { GeopinClient, GeopinGeocodeRequest, GeopinGeocodeResult } from 'geopin-sdk';
import type { GeocodingPort } from '../../../application/ports/out/GeocodingPort';

export class GeopinGeocodingAdapter implements GeocodingPort {
  constructor(private readonly client: GeopinClient) {}

  geocode(request: GeopinGeocodeRequest): Promise<GeopinGeocodeResult> {
    return this.client.geocode(request);
  }
}
