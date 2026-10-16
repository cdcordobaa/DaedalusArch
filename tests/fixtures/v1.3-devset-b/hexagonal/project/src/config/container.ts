import { BookingCli } from '../adapters/inbound/cli/BookingCli';
import { BookingController } from '../adapters/inbound/http/BookingController';
import { RoomController } from '../adapters/inbound/http/RoomController';
import { OutboxNotificationAdapter } from '../adapters/outbound/notification/OutboxNotificationAdapter';
import { FakePaymentGateway } from '../adapters/outbound/payment/FakePaymentGateway';
import { InMemoryBookingRepository } from '../adapters/outbound/persistence/InMemoryBookingRepository';
import { InMemoryGuestRepository } from '../adapters/outbound/persistence/InMemoryGuestRepository';
import { InMemoryRoomRepository } from '../adapters/outbound/persistence/InMemoryRoomRepository';
import { BookRoomService } from '../application/services/BookRoomService';
import { CancelBookingService } from '../application/services/CancelBookingService';
import { FindAvailableRoomsService } from '../application/services/FindAvailableRoomsService';

export interface Container {
  bookings: BookingController;
  rooms: RoomController;
  cli: BookingCli;
}

/** Composition root: the one place that plugs concrete adapters into the ports. */
export function createContainer(): Container {
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  const guests = new InMemoryGuestRepository();
  const payments = new FakePaymentGateway();
  const notifications = new OutboxNotificationAdapter();

  const bookRoom = new BookRoomService(rooms, bookings, guests, payments, notifications);
  return {
    bookings: new BookingController(bookRoom, new CancelBookingService(bookings, guests, payments, notifications)),
    rooms: new RoomController(new FindAvailableRoomsService(rooms, bookings)),
    cli: new BookingCli(bookRoom),
  };
}
