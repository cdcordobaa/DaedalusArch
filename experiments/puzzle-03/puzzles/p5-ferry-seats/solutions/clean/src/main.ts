import { SailingsDirectory } from './bookings/acl/SailingsDirectory';
import { NotifyDesk } from './bookings/application/NotifyDesk';
import type { BookingCancelled } from './bookings/domain/booking/events/BookingCancelled';
import type { BookingRequested } from './bookings/domain/booking/events/BookingRequested';
import { createBookings } from './bookings';
import { InMemoryBookingRepository } from './bookings/infrastructure/InMemoryBookingRepository';
import { InMemoryDeskNotices } from './bookings/infrastructure/InMemoryDeskNotices';
import { EventRelay } from './messaging/EventRelay';
import { createSailings } from './sailings';
import type { SeatsHeld } from './sailings/domain/sailing/events/SeatsHeld';
import type { SeatsRefused } from './sailings/domain/sailing/events/SeatsRefused';
import { InMemorySailingRepository } from './sailings/infrastructure/InMemorySailingRepository';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const sailingStore = new InMemorySailingRepository();
  const bookingStore = new InMemoryBookingRepository();
  const notices = new InMemoryDeskNotices();
  const sailings = createSailings(sailingStore);
  const bookings = createBookings(bookingStore, new SailingsDirectory(sailings));
  const relay = new EventRelay([sailingStore, bookingStore]);
  const notifyDesk = new NotifyDesk(notices);
  relay.on('BookingRequested', (e) => notifyDesk.handle(e));
  relay.on('BookingRequested', (e) => {
    const requested = e as BookingRequested;
    sailings.bookingRequested(requested.bookingId, requested.sailingId, requested.seats);
  });
  relay.on('SeatsHeld', (e) => bookings.seatsHeld((e as SeatsHeld).bookingId));
  relay.on('SeatsRefused', (e) => bookings.seatsRefused((e as SeatsRefused).bookingId));
  relay.on('BookingCancelled', (e) => {
    const cancelled = e as BookingCancelled;
    sailings.bookingCancelled(cancelled.bookingId, cancelled.sailingId);
  });
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    scheduleSailing: (route: string, departsAt: string, capacity: number): string => command(() => sailings.schedule(route, departsAt, capacity)),
    sailing: (sailingId: string) => sailings.sailing(sailingId),
    blockSeats: (sailingId: string, party: string, seats: number): void => command(() => sailings.holdSeats(sailingId, party, seats)),
    releaseBlock: (sailingId: string, party: string): void => command(() => sailings.releaseSeats(sailingId, party)),
    book: (passenger: string, sailingId: string, seats: number): string => command(() => bookings.book(passenger, sailingId, seats)),
    booking: (bookingId: string) => bookings.booking(bookingId),
    deskNotices: (): string[] => notices.all(),
    cancelBooking: (bookingId: string): void => command(() => bookings.cancel(bookingId)),
    cancelSailing: (sailingId: string): void => command(() => sailings.cancel(sailingId)),
  };
}
