import { SailingsDirectory } from './bookings/acl/SailingsDirectory';
import { NotifyDesk } from './bookings/application/NotifyDesk';
import { createBookings } from './bookings';
import { InMemoryBookingRepository } from './bookings/infrastructure/InMemoryBookingRepository';
import { InMemoryDeskNotices } from './bookings/infrastructure/InMemoryDeskNotices';
import { EventRelay } from './messaging/EventRelay';
import { createSailings } from './sailings';
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
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    scheduleSailing: (route: string, departsAt: string, capacity: number): string => command(() => sailings.schedule(route, departsAt, capacity)),
    sailing: (sailingId: string) => sailings.sailing(sailingId),
    cancelSailing: (sailingId: string): void => command(() => sailings.cancelSailing(sailingId)),
    blockSeats: (sailingId: string, party: string, seats: number): void => command(() => sailings.holdSeats(sailingId, party, seats)),
    releaseBlock: (sailingId: string, party: string): void => command(() => sailings.releaseSeats(sailingId, party)),
    book: (passenger: string, sailingId: string, seats: number): string => command(() => bookings.book(passenger, sailingId, seats)),
    cancelBooking: (bookingId: string): void => command(() => bookings.cancel(bookingId)),
    booking: (bookingId: string) => bookings.booking(bookingId),
    deskNotices: (): string[] => notices.all(),
  };
}
