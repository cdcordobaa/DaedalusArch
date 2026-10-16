import { Membership } from '@prisma/client';

export interface StartMembershipInput {
  readonly memberId: string;
  readonly planCode: string;
  readonly startsOn: string;
}

export interface PauseMembershipInput {
  readonly weeks: number;
  readonly reason: string;
}

export interface MembershipView {
  readonly id: string;
  readonly memberId: string;
  readonly planCode: string;
  readonly status: string;
  readonly startsOn: string;
  readonly pausedUntil: string | null;
  readonly meetingCredits: number;
}

export function toMembershipView(m: Membership): MembershipView {
  return {
    id: m.id,
    memberId: m.memberId,
    planCode: m.planCode,
    status: m.status,
    startsOn: m.startsOn.toISOString().slice(0, 10),
    pausedUntil: m.pausedUntil === null ? null : m.pausedUntil.toISOString().slice(0, 10),
    meetingCredits: m.meetingCredits,
  };
}
