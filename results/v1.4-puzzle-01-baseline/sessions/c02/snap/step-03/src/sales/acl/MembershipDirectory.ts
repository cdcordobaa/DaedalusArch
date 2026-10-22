import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

/** Translates the membership module's published calls into what orders need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  award(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }

  discountPercent(memberId: string): number {
    switch (this.membership.card(memberId)?.tier) {
      case 'gold':
        return 10;
      case 'silver':
        return 5;
      default:
        return 0;
    }
  }
}
