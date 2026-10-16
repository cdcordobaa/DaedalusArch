import { Booking } from '../../../domain/model/Booking';

/** Driven port (Cockburn 2005): booking persistence, implemented by an outbound adapter. */
export interface BookingRepository {
  findById(id: string): Promise<Booking | undefined>;
  findByRoom(roomId: string): Promise<Booking[]>;
  findActive(): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  nextId(): string;
}
