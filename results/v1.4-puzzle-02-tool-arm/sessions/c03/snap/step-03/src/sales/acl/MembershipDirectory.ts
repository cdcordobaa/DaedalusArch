import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

/** Translates the membership module's published calls into what orders need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  discountRate(memberId: string): number {
    switch (this.membership.card(memberId)?.tier) {
      case 'gold':
        return 0.1;
      case 'silver':
        return 0.05;
      default:
        return 0;
    }
  }
}
