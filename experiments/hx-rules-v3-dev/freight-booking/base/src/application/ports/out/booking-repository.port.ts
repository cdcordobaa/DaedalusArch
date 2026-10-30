import { Booking } from '../../../domain/booking';

export interface BookingRepositoryPort {
  findById(id: string): Promise<Booking | null>;
  save(booking: Booking): Promise<void>;
}
