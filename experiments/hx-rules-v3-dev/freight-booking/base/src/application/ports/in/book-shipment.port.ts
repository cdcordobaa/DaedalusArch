import { BookingStatus } from '../../../domain/booking';

export interface BookShipmentCommand {
  readonly bookingId: string;
}

export interface BookShipmentResult {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly chargeCents: number;
}

export interface BookShipmentPort {
  book(command: BookShipmentCommand): Promise<BookShipmentResult>;
}
