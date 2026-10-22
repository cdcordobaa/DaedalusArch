import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking reads. */
export interface BookingRepository {
  findActive(): Promise<Booking[]>;
}
