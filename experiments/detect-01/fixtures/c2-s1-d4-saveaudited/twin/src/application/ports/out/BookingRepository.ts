import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking persistence; a booking is saved with its audit trail. */
export interface BookingRepository {
  findById(id: string): Promise<Booking | undefined>;
  save(booking: Booking): Promise<void>;
}
