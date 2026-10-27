import { AddVisits } from './application/AddVisits';
import { GetGuestProfile } from './application/GetGuestProfile';
import { RecordVisit } from './application/RecordVisit';
import { RegisterGuest } from './application/RegisterGuest';
import type { GuestProfile } from './contracts/GuestProfile';
import type { GuestRepository } from './domain/guest/GuestRepository';
import { InMemoryGuestRepository } from './infrastructure/InMemoryGuestRepository';

export type { GuestProfile } from './contracts/GuestProfile';

/** What the rest of the system may call. */
export interface GuestsModule {
  register(name: string): string;
  addVisits(guestId: string, visits: number): void;
  profile(guestId: string): GuestProfile | undefined;
  /** Subscriber for a guest's completed reservation (delivered after the completion is stored). */
  visitCompleted(guestId: string, reservationId: string): void;
}

export function createGuests(guests: GuestRepository = new InMemoryGuestRepository()): GuestsModule {
  return {
    register: (name) => new RegisterGuest(guests).execute(name),
    addVisits: (guestId, visits) => new AddVisits(guests).execute(guestId, visits),
    profile: (guestId) => new GetGuestProfile(guests).execute(guestId),
    visitCompleted: (guestId, reservationId) => new RecordVisit(guests).execute(guestId, reservationId),
  };
}
