import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

/** Translates the membership module's published calls into what class bookings need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  levelOf(memberId: string): string | undefined {
    return this.membership.card(memberId)?.level;
  }

  addVisits(memberId: string, visits: number): void {
    this.membership.addVisits(memberId, visits);
  }
}
