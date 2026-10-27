import { AddVisits } from './application/AddVisits';
import { GetGuestProfile } from './application/GetGuestProfile';
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
}

export function createGuests(guests: GuestRepository = new InMemoryGuestRepository()): GuestsModule {
  return {
    register: (name) => new RegisterGuest(guests).execute(name),
    addVisits: (guestId, visits) => new AddVisits(guests).execute(guestId, visits),
    profile: (guestId) => new GetGuestProfile(guests).execute(guestId),
  };
}
