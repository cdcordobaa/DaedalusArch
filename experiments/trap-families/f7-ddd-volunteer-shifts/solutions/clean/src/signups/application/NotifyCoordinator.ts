import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { SignUpRequested } from '../domain/signup/events/SignUpRequested';
import type { CoordinatorNotices } from './ports/CoordinatorNotices';

/** Tells the coordinators about every new sign-up. */
export class NotifyCoordinator {
  constructor(private readonly notices: CoordinatorNotices) {}

  handle(event: DomainEvent): void {
    const requested = event as SignUpRequested;
    this.notices.add(`Sign-up ${requested.signUpId}: ${String(requested.places)} place(s) on ${requested.shiftId} for ${requested.volunteer}`);
  }
}
