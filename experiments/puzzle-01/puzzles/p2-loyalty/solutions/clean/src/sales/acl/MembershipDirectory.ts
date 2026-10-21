import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';
import type { CustomerTier } from '../domain/order/value-objects/CustomerTier';

/** Translates the membership module's published calls into what orders need. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  exists(memberId: string): boolean {
    return this.membership.card(memberId) !== undefined;
  }

  tierOf(memberId: string): CustomerTier {
    const tier = this.membership.card(memberId)?.tier;
    return tier === 'gold' || tier === 'silver' ? tier : 'standard';
  }
}
