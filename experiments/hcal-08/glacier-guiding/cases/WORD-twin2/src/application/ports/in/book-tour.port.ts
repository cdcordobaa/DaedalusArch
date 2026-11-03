import { BookingStatus } from '../../../domain/booking-status';

export interface BookTourCommand {
  readonly bookingId: string;
}

export interface BookTourResult {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly notes: string;
}

export interface BookTourPort {
  book(command: BookTourCommand): Promise<BookTourResult>;
}
