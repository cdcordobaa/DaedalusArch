import { AwardPoints } from './application/AwardPoints';
import { EnrolMember } from './application/EnrolMember';
import { EarnPointsFromPurchase } from './application/EarnPointsFromPurchase';
import { GetMemberCard } from './application/GetMemberCard';
import type { MemberCard } from './contracts/MemberCard';
import type { MemberRepository } from './domain/member/MemberRepository';
import { InMemoryMemberRepository } from './infrastructure/InMemoryMemberRepository';

export type { MemberCard } from './contracts/MemberCard';

/** What the rest of the system may call. */
export interface MembershipModule {
  enrol(name: string): string;
  awardPoints(memberId: string, points: number): void;
  card(memberId: string): MemberCard | undefined;
  earnPointsFromPurchase(memberId: string, paidCents: number): void;
}

export function createMembership(members: MemberRepository = new InMemoryMemberRepository()): MembershipModule {
  return {
    enrol: (name) => new EnrolMember(members).execute(name),
    awardPoints: (memberId, points) => new AwardPoints(members).execute(memberId, points),
    card: (memberId) => new GetMemberCard(members).execute(memberId),
    earnPointsFromPurchase: (memberId, paidCents) => new EarnPointsFromPurchase(members).execute(memberId, paidCents),
  };
}
