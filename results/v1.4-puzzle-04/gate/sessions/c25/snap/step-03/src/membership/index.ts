import { AwardPoints } from './application/AwardPoints';
import { EarnPointsFromOrder } from './application/EarnPointsFromOrder';
import { EnrolMember } from './application/EnrolMember';
import { GetMemberCard } from './application/GetMemberCard';
import type { MemberCard } from './contracts/MemberCard';
import type { MemberRepository } from './domain/member/MemberRepository';
import { InMemoryMemberRepository } from './infrastructure/InMemoryMemberRepository';

export type { MemberCard } from './contracts/MemberCard';

/** What the rest of the system may call. */
export interface MembershipModule {
  enrol(name: string): string;
  awardPoints(memberId: string, points: number): void;
  earnFromOrder(memberId: string, orderId: string, paidCents: number): void;
  card(memberId: string): MemberCard | undefined;
}

export function createMembership(members: MemberRepository = new InMemoryMemberRepository()): MembershipModule {
  return {
    enrol: (name) => new EnrolMember(members).execute(name),
    awardPoints: (memberId, points) => new AwardPoints(members).execute(memberId, points),
    earnFromOrder: (memberId, orderId, paidCents) => new EarnPointsFromOrder(members).execute(memberId, orderId, paidCents),
    card: (memberId) => new GetMemberCard(members).execute(memberId),
  };
}
