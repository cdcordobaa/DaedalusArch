import { createMembership } from './membership';
import { InMemoryMemberRepository } from './membership/infrastructure/InMemoryMemberRepository';
import { MembershipDirectory } from './bookings/acl/MembershipDirectory';
import { BookClass, type BookingRequest, type MadeBooking } from './bookings/application/BookClass';
import { ConfirmationNote } from './bookings/application/ConfirmationNote';
import { EventRelay } from './bookings/application/EventRelay';
import { SendConfirmation } from './bookings/application/SendConfirmation';
import { InMemoryBookingRepository } from './bookings/infrastructure/InMemoryBookingRepository';
import { InMemoryConfirmations } from './bookings/infrastructure/InMemoryConfirmations';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const members = new InMemoryMemberRepository();
  const membership = createMembership(members);
  const bookings = new InMemoryBookingRepository();
  const confirmations = new InMemoryConfirmations();
  const relay = new EventRelay(bookings);
  const sendConfirmation = new SendConfirmation(confirmations, new ConfirmationNote(members));
  relay.on('BookingMade', (e) => sendConfirmation.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    join: (name: string): string => membership.join(name),
    addVisits: (memberId: string, visits: number): void => membership.addVisits(memberId, visits),
    memberCard: (memberId: string) => membership.card(memberId),
    bookClass: (memberId: string | null, classes: BookingRequest[]): MadeBooking =>
      command(() => new BookClass(bookings, new MembershipDirectory(membership)).execute(memberId, classes)),
    confirmations: (): string[] => confirmations.all(),
  };
}
