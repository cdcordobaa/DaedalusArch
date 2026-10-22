import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { MemberDirectory } from './ports/MemberDirectory';

/** One point per whole 1.00 paid after the discount; guests earn nothing. */
export class AwardOrderPoints {
  constructor(private readonly directory: MemberDirectory) {}

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null) return;
    const points = Math.floor(placed.paidCents / 100);
    if (points > 0) this.directory.awardPoints(placed.memberId, points);
  }
}
