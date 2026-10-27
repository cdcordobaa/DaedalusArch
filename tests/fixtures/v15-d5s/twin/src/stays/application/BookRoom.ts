import { RoomSchedule } from '../domain/schedule/RoomSchedule';
import { BookingRepository } from '../domain/booking/BookingRepository';
export class BookRoom {
  constructor(private readonly bookings: BookingRepository) {}
  execute(reference: string, roomId: string, checkIn: number, checkOut: number): void {
    if (this.bookings.byReference(reference) !== undefined) throw new Error('reference taken');
    const schedule = new RoomSchedule(roomId, this.bookings.forRoom(roomId));
    this.bookings.save(schedule.book(reference, checkIn, checkOut));
  }
}
