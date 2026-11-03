import { BookingStatus } from '../../../domain/booking-status';

export interface BookTourCommand {
  readonly bookingId: string;
}

export interface BookTourResult {
  readonly bookingId: string;
  readonly status: BookingStatus;
}

export interface BookTourPort {
  book(command: BookTourCommand): Promise<BookTourResult>;
}
