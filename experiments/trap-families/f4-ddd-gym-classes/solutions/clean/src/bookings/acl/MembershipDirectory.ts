import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';
import type { CustomerLevel } from '../domain/booking/value-objects/CustomerLevel';

/** Translates the membership module's published calls into what class bookings need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  levelOf(memberId: string): CustomerLevel {
    const level = this.membership.card(memberId)?.level;
    return level === 'premium' || level === 'plus' ? level : 'basic';
  }
}
