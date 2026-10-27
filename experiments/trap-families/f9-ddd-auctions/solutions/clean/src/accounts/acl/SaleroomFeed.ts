import type { BidderOutbidMessage, BidPlacedMessage, LotSoldMessage, LotUnsoldMessage } from '../../saleroom/contracts/SaleroomMessages';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

/** Reads what accounts need from the messages the saleroom publishes. */
export const SaleroomFeed = {
  bidPlaced(event: DomainEvent): BidPlacedMessage {
    return event as unknown as BidPlacedMessage;
  },
  bidderOutbid(event: DomainEvent): BidderOutbidMessage {
    return event as unknown as BidderOutbidMessage;
  },
  lotSold(event: DomainEvent): LotSoldMessage {
    return event as unknown as LotSoldMessage;
  },
  lotUnsold(event: DomainEvent): LotUnsoldMessage {
    return event as unknown as LotUnsoldMessage;
  },
};
