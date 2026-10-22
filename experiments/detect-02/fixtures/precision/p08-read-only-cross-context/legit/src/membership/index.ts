import { AwardPoints } from './application/AwardPoints';
import { GetMemberCard } from './application/GetMemberCard';
import type { MemberCard } from './contracts/MemberCard';
import type { MemberRepository } from './domain/member/MemberRepository';

export type { MemberCard } from './contracts/MemberCard';

export interface MembershipModule {
  card(memberId: string): MemberCard | undefined;
  awardPoints(memberId: string, points: number): void;
}

export function createMembership(members: MemberRepository): MembershipModule {
  return {
    card: (memberId) => new GetMemberCard(members).execute(memberId),
    awardPoints: (memberId, points) => new AwardPoints(members).execute(memberId, points),
  };
}
