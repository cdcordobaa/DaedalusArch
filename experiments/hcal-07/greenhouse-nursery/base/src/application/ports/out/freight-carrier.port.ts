import { FreightBooking } from '../../../domain/freight';

export interface FreightRequest {
  readonly postcode: string;
  readonly pallets: number;
  readonly weightKg: number;
  readonly collectionDate: string;
}

export interface FreightCarrierPort {
  book(request: FreightRequest): Promise<FreightBooking>;
}
