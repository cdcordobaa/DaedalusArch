import { BookingStatus } from '../../../domain/booking';

export interface ShipperNotifierPort {
  notifyBooking(shipperId: string, bookingId: string, status: BookingStatus): Promise<void>;
}
