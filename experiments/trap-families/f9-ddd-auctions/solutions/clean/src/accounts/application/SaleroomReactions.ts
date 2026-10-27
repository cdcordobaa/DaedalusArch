import type { AccountStore } from '../domain/AccountStore';
import type { BidderAccount } from '../domain/BidderAccount';

/** How a paddle account follows what happened in the saleroom; each reaction writes one account. */
export class SaleroomReactions {
  constructor(private readonly store: AccountStore) {}

  bidLeads(accountId: string, lotId: string, amount: number): void {
    this.change(accountId, (a) => a.takeLeadingBid(lotId, amount));
  }

  bidStoppedLeading(accountId: string, lotId: string): void {
    this.change(accountId, (a) => a.freeLeadingBid(lotId));
  }

  lotBought(accountId: string, lotId: string, hammerPrice: number): void {
    this.change(accountId, (a) => a.buy(lotId, hammerPrice));
  }

  private change(accountId: string, f: (account: BidderAccount) => void): void {
    const account = this.store.find(accountId);
    if (account === undefined) return;
    f(account);
    this.store.save(account);
  }
}
