import { BookingView } from './BookingView';

export interface BookRoomCommand {
  roomId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

/** Driving port (Cockburn 2005): what the outside world may ask the application to do. */
export interface BookRoom {
  book(command: BookRoomCommand): Promise<BookingView>;
}
