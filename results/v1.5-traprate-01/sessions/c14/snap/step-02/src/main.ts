import { createAccounts } from './accounts/api/AccountsFacade';
import { InMemoryAccountStore } from './accounts/infrastructure/InMemoryAccountStore';
import { deliverAfter } from './plumbing/deliverAfter';
import { MessageDispatcher } from './plumbing/MessageDispatcher';
import { Outbox } from './plumbing/Outbox';
import { AccountsLookup } from './saleroom/acl/AccountsLookup';
import { createSaleroom } from './saleroom/api/SaleroomFacade';
import { InMemoryLotStore } from './saleroom/infrastructure/InMemoryLotStore';

/** Composition root of the auction house. Every command has its events delivered before it returns. */
export function createApp() {
  const outbox = new Outbox();
  const dispatcher = new MessageDispatcher(outbox);
  const accounts = createAccounts(new InMemoryAccountStore(outbox));
  const saleroom = createSaleroom(new InMemoryLotStore(outbox), new AccountsLookup(accounts));

  dispatcher.subscribe('BidPlaced', accounts.reactions.bidPlaced);
  dispatcher.subscribe('LotClosed', accounts.reactions.lotClosed);

  const command = deliverAfter(dispatcher);
  return {
    // bidder accounts and the finance desk
    registerBidder: command((name: string, creditLimit: number) => accounts.register(name, creditLimit)),
    account: (accountId: string) => accounts.account(accountId),
    holdCredit: command((accountId: string, ref: string, amount: number) => accounts.holdCredit(accountId, ref, amount)),
    releaseCredit: command((accountId: string, ref: string) => accounts.releaseCredit(accountId, ref)),
    // the saleroom
    openLot: command((title: string, openingBid: number, reserve: number) => saleroom.openLot(title, openingBid, reserve)),
    lot: (lotId: string) => saleroom.lot(lotId),
    closeLot: command((lotId: string) => saleroom.closeLot(lotId)),
    placeBid: command((lotId: string, bidderId: string, amount: number) => saleroom.placeBid(lotId, bidderId, amount)),
  };
}
