import type { BidderOutbidMessage, BidPlacedMessage, LotUnsoldMessage } from '../../saleroom/contracts/SaleroomMessages';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

/** Reads what accounts need from the messages the saleroom publishes. */
export const SaleroomFeed = {
  bidderOf(event: DomainEvent): string {
    return (event as unknown as BidPlacedMessage).bidderId;
  },
  lotOf(event: DomainEvent): string {
    return (event as unknown as BidPlacedMessage).lotId;
  },
  amountOf(event: DomainEvent): number {
    return (event as unknown as BidPlacedMessage).amount;
  },
  unsoldBidderOf(event: DomainEvent): string | null {
    return (event as unknown as LotUnsoldMessage).bidderId;
  },
  outbidBidderOf(event: DomainEvent): string {
    return (event as unknown as BidderOutbidMessage).bidderId;
  },
};
