import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { MemberDirectory } from './ports/MemberDirectory';

/** Puts the points an order earned on the member's card. */
export class CreditPoints {
  constructor(private readonly directory: MemberDirectory) {}

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    if (placed.memberId === null || placed.pointsEarned <= 0) return;
    this.directory.awardPoints(placed.memberId, placed.pointsEarned);
  }
}
