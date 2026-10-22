import { BookingError } from '../../domain/errors/BookingError';
import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import { AvailabilityChecker } from '../../domain/services/AvailabilityChecker';
import { PriceCalculator } from '../../domain/services/PriceCalculator';
import { BookRoom, BookRoomCommand } from '../ports/in/BookRoom';
import { BookingView, toBookingView } from '../ports/in/BookingView';
import { BookingRepository } from '../ports/out/BookingRepository';
import { GuestRepository } from '../ports/out/GuestRepository';
import { NotificationSender } from '../ports/out/NotificationSender';
import { PaymentGateway } from '../ports/out/PaymentGateway';
import { RoomRepository } from '../ports/out/RoomRepository';

export class BookRoomService implements BookRoom {
  private readonly availability = new AvailabilityChecker();
  private readonly pricing = new PriceCalculator();

  constructor(
    private readonly rooms: RoomRepository,
    private readonly bookings: BookingRepository,
    private readonly guests: GuestRepository,
    private readonly payments: PaymentGateway,
    private readonly notifications: NotificationSender,
  ) {}

  async book(command: BookRoomCommand): Promise<BookingView> {
    const room = await this.rooms.findById(command.roomId);
    if (room === undefined) throw new BookingError('not-found', `No room ${command.roomId}`);
    const guest = await this.guests.findById(command.guestId);
    if (guest === undefined) throw new BookingError('not-found', `No guest ${command.guestId}`);
    if (!room.fits(command.guests)) throw new BookingError('invalid', `Room ${room.number} sleeps ${room.capacity}`);

    const stay = DateRange.parse(command.checkIn, command.checkOut);
    if (!this.availability.isAvailable(room, stay, await this.bookings.findByRoom(room.id))) {
      throw new BookingError('unavailable', `Room ${room.number} is taken for these dates`);
    }
    const total = this.pricing.quote(room, stay);
    const paymentRef = await this.payments.charge(guest.id, total);
    const booking = new Booking(this.bookings.nextId(), room.id, guest.id, stay, total, paymentRef);
    await this.bookings.save(booking);
    await this.notifications.send(guest.email, `Room ${room.number} is booked (${booking.id})`);
    return toBookingView(booking);
  }
}
