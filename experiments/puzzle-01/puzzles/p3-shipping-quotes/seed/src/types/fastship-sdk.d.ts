// Typings of the Fastship carrier SDK (fastship-sdk 3.2), as shipped by the vendor.
declare module 'fastship-sdk' {
  export interface FastshipAddress {
    country: string;
    postcode?: string;
  }
  export interface FastshipRateRequest {
    origin: FastshipAddress;
    destination: FastshipAddress;
    parcel: { weight: { value: number; unit: 'g' | 'kg' } };
  }
  export interface FastshipRate {
    serviceCode: 'STD' | 'EXP' | 'FREIGHT';
    serviceName: string;
    amount: { value: string; currency: string };
    transitDays: number;
  }
  export interface FastshipRateResponse {
    rates: FastshipRate[];
  }
  export interface FastshipTrackingEvent {
    code: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
    timestamp: string;
    location?: string;
  }
  export class FastshipUnavailableError extends Error {}
  export class FastshipClient {
    constructor(options: { apiKey: string });
    rates(request: FastshipRateRequest): Promise<FastshipRateResponse>;
    tracking(trackingNumber: string): Promise<FastshipTrackingEvent[]>;
  }
}
