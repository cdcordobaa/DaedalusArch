import type { LotClosedMessage } from '../../saleroom/contracts/SaleroomMessages';
import type { AccountStore } from '../domain/AccountStore';

/** Settles the leading paddle when a lot closes: a buyer owes the price and premium, otherwise the held credit is given back. */
export class SettleLot {
  constructor(private readonly store: AccountStore) {}

  handle(closed: LotClosedMessage): void {
    if (closed.bidderId === null) return;
    const account = this.store.find(closed.bidderId);
    if (account === undefined) return;
    if (closed.outcome === 'sold') account.buy(closed.amount);
    else account.releaseBid(closed.lotId);
    this.store.save(account);
  }
}
