import { Booking } from '../../../domain/model/Booking';

export interface BookingView {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  totalCents: number;
  status: string;
}

export function toBookingView(booking: Booking): BookingView {
  return {
    id: booking.id,
    roomId: booking.roomId,
    checkIn: booking.stay.checkIn.toISOString(),
    checkOut: booking.stay.checkOut.toISOString(),
    totalCents: booking.total.cents,
    status: booking.status,
  };
}
