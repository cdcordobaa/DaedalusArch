import { BookingStatus } from '../../../domain/booking-status';

export interface OwnerNotifierPort {
  notify(ownerId: string, bookingId: string, status: BookingStatus): Promise<void>;
}
