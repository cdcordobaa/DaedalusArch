import { CarrierAnswer } from '../../../domain/booking';

export interface CarrierQuery {
  readonly shipperId: string;
  readonly laneCode: string;
  readonly palletCount: number;
}

export interface CarrierBookingPort {
  request(query: CarrierQuery): Promise<CarrierAnswer>;
}
