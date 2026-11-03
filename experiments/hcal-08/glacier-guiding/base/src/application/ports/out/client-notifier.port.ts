import { BookingStatus } from '../../../domain/booking-status';

export interface ClientNotifierPort {
  notify(clientId: string, bookingId: string, status: BookingStatus): Promise<void>;
}
