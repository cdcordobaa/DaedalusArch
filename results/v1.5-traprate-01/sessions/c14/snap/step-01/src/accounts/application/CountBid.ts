import type { BidPlacedMessage } from '../../saleroom/contracts/SaleroomMessages';
import type { AccountStore } from '../domain/AccountStore';

/** Keeps each paddle's count of bids taken in the saleroom and the credit that covers the bids it leads with. */
export class CountBid {
  constructor(private readonly store: AccountStore) {}

  handle(bid: BidPlacedMessage): void {
    if (bid.previousBidderId !== null) {
      const previous = this.store.find(bid.previousBidderId);
      if (previous !== undefined) {
        previous.releaseBid(bid.lotId);
        this.store.save(previous);
      }
    }
    const account = this.store.find(bid.bidderId);
    if (account === undefined) return;
    account.countBid();
    account.holdForBid(bid.lotId, bid.amount);
    this.store.save(account);
  }
}
