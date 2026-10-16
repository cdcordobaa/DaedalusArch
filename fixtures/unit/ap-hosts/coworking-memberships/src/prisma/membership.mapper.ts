import { Membership as MembershipRow } from '@prisma/client';
import { Membership, MembershipStatus } from '../domain/membership';
import { MembershipPlan } from '../domain/membership-plan';

/** Rebuilds the domain membership from its Prisma row. */
export function toMembership(row: MembershipRow): Membership {
  return new Membership(row.id, row.memberId, MembershipPlan.byCode(row.planCode), row.status as MembershipStatus, row.pausedUntil);
}
