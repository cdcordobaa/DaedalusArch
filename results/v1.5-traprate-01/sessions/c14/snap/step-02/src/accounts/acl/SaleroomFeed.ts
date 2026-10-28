import type { BidPlacedMessage, LotClosedMessage } from '../../saleroom/contracts/SaleroomMessages';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

/** Reads what accounts need from the messages the saleroom publishes. */
export const SaleroomFeed = {
  bidderOf(event: DomainEvent): string {
    return (event as unknown as BidPlacedMessage).bidderId;
  },
  closedOf(event: DomainEvent): LotClosedMessage {
    return event as unknown as LotClosedMessage;
  },
  bidOf(event: DomainEvent): BidPlacedMessage {
    return event as unknown as BidPlacedMessage;
  },
};
