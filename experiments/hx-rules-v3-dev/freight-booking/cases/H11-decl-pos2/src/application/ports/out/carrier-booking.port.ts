import { BookingStatus } from '../../../domain/booking';

export interface CarrierQuery {
  readonly shipperId: string;
  readonly laneCode: string;
  readonly palletCount: number;
}

export interface BookingReply {
  readonly reference: string;
  readonly status: BookingStatus;
  readonly chargeCents: number;
}

export interface CarrierBookingPort {
  request(query: CarrierQuery): Promise<BookingReply>;
}
