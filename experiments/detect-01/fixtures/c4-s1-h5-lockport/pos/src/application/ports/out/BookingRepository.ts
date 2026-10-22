import { Booking } from '../../../domain/model/Booking';

/** Driven port: booking persistence. */
export interface BookingRepository {
  findByRoom(roomId: string): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  nextId(): string;
  /**
   * Runs `task` while holding an exclusive claim on the room, across all servers sharing the store.
   * Reads and the save made through the repository handed to `task` belong to one unit of work.
   */
  withRoomLock<T>(roomId: string, task: (bookings: BookingRepository) => Promise<T>): Promise<T>;
}
