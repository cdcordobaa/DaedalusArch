import { SailingsDirectory } from './bookings/acl/SailingsDirectory';
import { NotifyDesk } from './bookings/application/NotifyDesk';
import { createBookings } from './bookings';
import { InMemoryBookingRepository } from './bookings/infrastructure/InMemoryBookingRepository';
import { InMemoryDeskNotices } from './bookings/infrastructure/InMemoryDeskNotices';
import { EventRelay } from './messaging/EventRelay';
import { SettleBooking } from './bookings/application/SettleBooking';
import { ReserveSeatsForBooking } from './sailings/application/ReserveSeatsForBooking';
import { ReleaseSeatsForBooking } from './sailings/application/ReleaseSeatsForBooking';
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
  const reserveSeats = new ReserveSeatsForBooking(sailingStore);
  const settleBooking = new SettleBooking(bookingStore);
  relay.on('BookingRequested', (e) => reserveSeats.handle(e));
  relay.on('SeatsReserved', (e) => settleBooking.handle(e));
  relay.on('SeatsRefused', (e) => settleBooking.handle(e));
  const releaseSeats = new ReleaseSeatsForBooking(sailingStore);
  relay.on('BookingCancelled', (e) => releaseSeats.handle(e));
  const command =<T>(run: () => T): T => {
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
    cancelBooking: (bookingId: string): void => command(() => bookings.cancel(bookingId)),
    deskNotices: (): string[] => notices.all(),
  };
}
