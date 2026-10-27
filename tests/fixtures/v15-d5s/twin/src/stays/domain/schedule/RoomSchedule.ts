import { Booking } from '../booking/Booking';
export class RoomSchedule {
  constructor(readonly roomId: string, private readonly stays: Booking[]) {}
  book(reference: string, checkIn: number, checkOut: number): Booking {
    if (this.stays.some((b) => b.checkIn < checkOut && checkIn < b.checkOut)) throw new Error('room already booked');
    const b = new Booking(reference, this.roomId, checkIn, checkOut);
    this.stays.push(b);
    return b;
  }
}
