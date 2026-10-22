import type { Transaction } from 'sqlwell';
import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking persistence. */
export interface BookingRepository {
  findByRoom(roomId: string, tx?: Transaction): Promise<Booking[]>;
  save(booking: Booking, tx?: Transaction): Promise<void>;
  nextId(): string;
  inTransaction<T>(task: (tx: Transaction) => Promise<T>): Promise<T>;
}
