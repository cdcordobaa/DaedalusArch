import type { GeopinGeocodeRequest, GeopinGeocodeResult } from 'geopin-sdk';

export interface GeocodingPort {
  geocode(request: GeopinGeocodeRequest): Promise<GeopinGeocodeResult>;
}
