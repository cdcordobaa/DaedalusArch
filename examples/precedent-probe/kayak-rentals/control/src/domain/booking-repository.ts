import type { Booking } from './booking';

export interface BookingRepository {
  findById(id: string): Promise<Booking | undefined>;
  findByKayak(kayakId: string): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
}
