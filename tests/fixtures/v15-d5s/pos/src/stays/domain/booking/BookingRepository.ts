import { Booking } from './Booking';
export interface BookingRepository {
  forRoom(roomId: string): Booking[];
  byReference(reference: string): Booking | undefined;
  save(b: Booking): void;
}
