import { AddVisits } from './application/AddVisits';
import { CreditBooking } from './application/CreditBooking';
import { GetMemberCard } from './application/GetMemberCard';
import { JoinGym } from './application/JoinGym';
import type { MemberCard } from './contracts/MemberCard';
import type { MemberRepository } from './domain/member/MemberRepository';
import { InMemoryMemberRepository } from './infrastructure/InMemoryMemberRepository';

export type { MemberCard } from './contracts/MemberCard';

/** What the rest of the system may call. */
export interface MembershipModule {
  join(name: string): string;
  addVisits(memberId: string, visits: number): void;
  card(memberId: string): MemberCard | undefined;
  /** Subscriber for a member's class booking (delivered after the booking is stored). */
  bookingMade(memberId: string, bookingId: string, sessions: number): void;
}

export function createMembership(members: MemberRepository = new InMemoryMemberRepository()): MembershipModule {
  return {
    join: (name) => new JoinGym(members).execute(name),
    addVisits: (memberId, visits) => new AddVisits(members).execute(memberId, visits),
    card: (memberId) => new GetMemberCard(members).execute(memberId),
    bookingMade: (memberId, bookingId, sessions) => new CreditBooking(members).execute(memberId, bookingId, sessions),
  };
}
