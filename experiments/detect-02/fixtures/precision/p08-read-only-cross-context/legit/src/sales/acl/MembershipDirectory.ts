import type { MembershipModule } from '../../membership';
import type { MemberDirectory } from '../application/ports/MemberDirectory';

/** Translates membership's published calls into what sales needs. */
export class MembershipDirectory implements MemberDirectory {
  constructor(private readonly membership: MembershipModule) {}

  tierOf(memberId: string): string {
    return this.membership.card(memberId)?.tier ?? 'standard';
  }
}
