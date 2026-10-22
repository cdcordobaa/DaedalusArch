import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { MemberDirectory } from './ports/MemberDirectory';

/** Members earn one point per whole currency unit paid after the discount. Guests earn nothing. */
export class AwardOrderPoints {
  constructor(private readonly directory: MemberDirectory) {}

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null) return;
    const points = Math.floor(placed.totalCents / 100);
    if (points > 0) this.directory.awardPoints(placed.memberId, points);
  }
}
