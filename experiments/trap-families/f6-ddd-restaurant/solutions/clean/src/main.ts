import { createGuests } from './guests';
import { InMemoryGuestRepository } from './guests/infrastructure/InMemoryGuestRepository';
import { GuestProfiles } from './reservations/acl/GuestProfiles';
import { BookTable, type BookedTable } from './reservations/application/BookTable';
import { CompleteReservation } from './reservations/application/CompleteReservation';
import { ConfirmationNote } from './reservations/application/ConfirmationNote';
import { EventRelay } from './reservations/application/EventRelay';
import { SendConfirmation } from './reservations/application/SendConfirmation';
import { SendThankYou } from './reservations/application/SendThankYou';
import type { ReservationCompleted } from './reservations/domain/reservation/events/ReservationCompleted';
import { InMemoryMessages } from './reservations/infrastructure/InMemoryMessages';
import { InMemoryReservationRepository } from './reservations/infrastructure/InMemoryReservationRepository';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const guestStore = new InMemoryGuestRepository();
  const guests = createGuests(guestStore);
  const reservations = new InMemoryReservationRepository();
  const messages = new InMemoryMessages();
  const relay = new EventRelay(reservations);
  const sendConfirmation = new SendConfirmation(messages, new ConfirmationNote(guestStore));
  const sendThankYou = new SendThankYou(messages);
  relay.on('TableBooked', (e) => sendConfirmation.handle(e));
  relay.on('ReservationCompleted', (e) => {
    const completed = e as ReservationCompleted;
    if (completed.guestId !== null) guests.visitCompleted(completed.guestId, completed.reservationId);
  });
  relay.on('ReservationCompleted', (e) => sendThankYou.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    registerGuest: (name: string): string => guests.register(name),
    addVisits: (guestId: string, visits: number): void => guests.addVisits(guestId, visits),
    guestProfile: (guestId: string) => guests.profile(guestId),
    book: (guestId: string | null, partySize: number): BookedTable =>
      command(() => new BookTable(reservations, new GuestProfiles(guests)).execute(guestId, partySize)),
    complete: (reservationId: string): void => command(() => new CompleteReservation(reservations).execute(reservationId)),
    messages: (): string[] => messages.all(),
  };
}
