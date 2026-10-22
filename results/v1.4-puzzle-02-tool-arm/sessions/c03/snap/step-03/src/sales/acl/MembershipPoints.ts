import type { MembershipModule } from '../../membership';
import type { MemberPoints } from '../application/ports/MemberPoints';

/** Credits points through the membership module's published calls. */
export class MembershipPoints implements MemberPoints {
  constructor(private readonly membership: MembershipModule) {}

  award(memberId: string, points: number): void {
    this.membership.awardPoints(memberId, points);
  }
}
