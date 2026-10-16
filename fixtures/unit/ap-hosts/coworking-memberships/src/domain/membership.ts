import { DomainError } from './domain-error';
import { MembershipPlan } from './membership-plan';

export type MembershipStatus = 'active' | 'paused' | 'cancelled';

/** Longest pause in one calendar year; longer breaks end the membership. */
export const MAX_PAUSE_WEEKS = 12;

export class MembershipStateError extends DomainError {
  constructor(action: string, status: MembershipStatus) {
    super('MEMBERSHIP_STATE', `Cannot ${action} a ${status} membership`);
  }
}

export class Membership {
  status: MembershipStatus;
  pausedUntil: Date | null;

  constructor(
    readonly id: string,
    readonly memberId: string,
    readonly plan: MembershipPlan,
    status: MembershipStatus,
    pausedUntil: Date | null,
  ) {
    this.status = status;
    this.pausedUntil = pausedUntil;
  }

  pause(until: Date): void {
    if (this.status !== 'active') {
      throw new MembershipStateError('pause', this.status);
    }
    this.status = 'paused';
    this.pausedUntil = until;
  }

  resume(): void {
    if (this.status !== 'paused') {
      throw new MembershipStateError('resume', this.status);
    }
    this.status = 'active';
    this.pausedUntil = null;
  }

  cancel(): void {
    if (this.status === 'cancelled') {
      throw new MembershipStateError('cancel', this.status);
    }
    this.status = 'cancelled';
  }

  canBookDesks(): boolean {
    return this.status === 'active' && this.plan.includesDesk();
  }
}
