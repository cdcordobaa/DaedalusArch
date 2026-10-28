import type { AccountStore } from '../domain/AccountStore';

/** Keeps each paddle's count of bids taken in the saleroom (shown on the bidder's statement) and the credit they use. */
export class CountBid {
  constructor(private readonly store: AccountStore) {}

  handle(accountId: string, lotId: string, amount: number): void {
    const account = this.store.find(accountId);
    if (account === undefined) return;
    account.countBid();
    account.holdForBid(lotId, amount);
    this.store.save(account);
  }

  /** The hammer came down on the bidder's leading bid. */
  sold(accountId: string, amount: number): void {
    const account = this.store.find(accountId);
    if (account === undefined) return;
    account.recordPurchase(amount);
    this.store.save(account);
  }

  /** The bidder was outbid on the lot: the amount comes back. */
  outbid(accountId: string, lotId: string): void {
    const account = this.store.find(accountId);
    if (account === undefined) return;
    account.releaseBid(lotId);
    this.store.save(account);
  }
}
