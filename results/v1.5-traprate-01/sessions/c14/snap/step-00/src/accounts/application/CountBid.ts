import type { AccountStore } from '../domain/AccountStore';

/** Keeps each paddle's count of bids taken in the saleroom (shown on the bidder's statement). */
export class CountBid {
  constructor(private readonly store: AccountStore) {}

  handle(accountId: string): void {
    const account = this.store.find(accountId);
    if (account === undefined) return;
    account.countBid();
    this.store.save(account);
  }
}
