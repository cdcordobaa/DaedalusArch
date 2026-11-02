// Typings of the Geopin geocoding SDK (geopin-sdk 4.3), as shipped by the vendor.
declare module 'geopin-sdk' {
  export interface GeopinLatLng {
    lat: number;
    lng: number;
  }
  export interface GeopinAddressQuery {
    addressLine: string;
    postalCode?: string;
    locality?: string;
  }
  export interface GeopinGeocodeRequest {
    query: GeopinAddressQuery;
    countryIso: string;
    maxResults?: number;
  }
  export interface GeopinAddressComponents {
    addressLine?: string;
    postalCode?: string;
    locality?: string;
    countryIso: string;
  }
  export interface GeopinMatch {
    formattedAddress: string;
    precision: 'ROOFTOP' | 'STREET' | 'LOCALITY' | 'POSTCODE';
    confidence: number;
    location: GeopinLatLng;
    components: GeopinAddressComponents;
  }
  export interface GeopinGeocodeResult {
    matches: GeopinMatch[];
  }
  export interface GeopinPlacesRequest {
    postalCode: string;
    countryIso: string;
    category: 'PARCEL_LOCKER' | 'POST_OFFICE' | 'SHOP';
  }
  export interface GeopinPlace {
    placeId: string;
    displayName: string;
    formattedAddress: string;
    location: GeopinLatLng;
  }
  export class GeopinUnavailableError extends Error {}
  export class GeopinClient {
    constructor(options: { apiKey: string });
    geocode(request: GeopinGeocodeRequest): Promise<GeopinGeocodeResult>;
    places(request: GeopinPlacesRequest): Promise<GeopinPlace[]>;
  }
}
