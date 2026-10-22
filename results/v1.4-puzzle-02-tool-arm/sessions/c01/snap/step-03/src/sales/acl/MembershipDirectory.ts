import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

/** Translates the membership module's published calls into what orders need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  tierOf(memberId: string): string | undefined {
    return this.membership.card(memberId)?.tier;
  }

  awardPoints(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }
}
