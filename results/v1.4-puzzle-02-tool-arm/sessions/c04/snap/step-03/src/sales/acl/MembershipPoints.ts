import type { MembershipModule } from '../../membership';
import type { MemberPoints } from '../application/ports/MemberPoints';

/** Translates point awards into the membership module's published call. */
export class MembershipPoints implements MemberPoints {
  constructor(private readonly membership: MembershipModule) {}

  award(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }
}
