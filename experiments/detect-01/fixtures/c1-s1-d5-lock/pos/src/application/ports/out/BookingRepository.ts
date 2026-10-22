import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking persistence. */
export interface BookingRepository {
  findByRoom(roomId: string): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  nextId(): string;
}
