import { Booking } from '../domain/booking/Booking';
import { BookingRepository } from '../domain/booking/BookingRepository';
export class BookRoom {
  constructor(private readonly bookings: BookingRepository) {}
  execute(reference: string, roomId: string, checkIn: number, checkOut: number): void {
    if (this.bookings.byReference(reference) !== undefined) throw new Error('reference taken');
    const existing = this.bookings.forRoom(roomId);
    const clash = existing.some((b) => b.roomId === roomId && b.checkIn < checkOut && checkIn < b.checkOut);
    if (clash) throw new Error('room already booked');
    this.bookings.save(new Booking(reference, roomId, checkIn, checkOut));
  }
}
