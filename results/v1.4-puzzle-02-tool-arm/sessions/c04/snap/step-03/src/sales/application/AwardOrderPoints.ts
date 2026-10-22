import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { MemberPoints } from './ports/MemberPoints';

/** One point per whole 1.00 paid after the discount; guests earn nothing. */
export class AwardOrderPoints {
  constructor(private readonly points: MemberPoints) {}

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null) return;
    const earned = Math.floor(placed.totalCents / 100);
    if (earned > 0) this.points.award(placed.memberId, earned);
  }
}
