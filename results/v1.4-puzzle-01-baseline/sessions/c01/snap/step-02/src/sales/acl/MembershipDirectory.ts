import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

const DISCOUNT_BY_TIER: Readonly<Record<string, number>> = { gold: 10, silver: 5 };

/** Translates the membership module's published calls into what orders need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  discountPercent(memberId: string): number {
    const tier = this.membership.card(memberId)?.tier;
    return tier === undefined ? 0 : (DISCOUNT_BY_TIER[tier] ?? 0);
  }
}
