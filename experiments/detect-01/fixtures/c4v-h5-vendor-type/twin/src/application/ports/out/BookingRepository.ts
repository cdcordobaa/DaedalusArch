import { Booking } from '../../../domain/model/Booking';
import type { UnitOfWork } from './UnitOfWork';

/** Driven port: booking persistence. */
export interface BookingRepository {
  findByRoom(roomId: string, work?: UnitOfWork): Promise<Booking[]>;
  save(booking: Booking, work?: UnitOfWork): Promise<void>;
  nextId(): string;
  inTransaction<T>(task: (work: UnitOfWork) => Promise<T>): Promise<T>;
}
