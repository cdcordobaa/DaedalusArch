import { SaleroomFeed } from '../acl/SaleroomFeed';
import { AccountCommands } from '../application/AccountCommands';
import { AccountQueries } from '../application/AccountQueries';
import { CountBid } from '../application/CountBid';
import type { AccountView } from '../contracts/AccountView';
import type { AccountStore } from '../domain/AccountStore';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

export type { AccountView } from '../contracts/AccountView';

/** What the rest of the house may call on bidder accounts. */
export interface AccountsApi {
  register(name: string, creditLimit: number): string;
  account(accountId: string): AccountView | undefined;
  /** The finance desk sets credit aside, for example for a telephone or absentee bid. */
  holdCredit(accountId: string, ref: string, amount: number): void;
  releaseCredit(accountId: string, ref: string): void;
  /** The finance desk suspends a bidder, for example when a deposit is not paid. */
  suspendAccount(accountId: string): void;
  /** Reactions to messages from elsewhere in the house. */
  readonly reactions: {
    bidPlaced(event: DomainEvent): void;
    bidderOutbid(event: DomainEvent): void;
    lotSold(event: DomainEvent): void;
    lotUnsold(event: DomainEvent): void;
  };
}

export function createAccounts(store: AccountStore): AccountsApi {
  const commands = new AccountCommands(store);
  const queries = new AccountQueries(store);
  return {
    register: (name, creditLimit) => commands.register(name, creditLimit),
    account: (accountId) => queries.view(accountId),
    holdCredit: (accountId, ref, amount) => commands.holdCredit(accountId, ref, amount),
    releaseCredit: (accountId, ref) => commands.releaseCredit(accountId, ref),
    suspendAccount: (accountId) => commands.suspend(accountId),
    reactions: {
      bidPlaced: (event) => new CountBid(store).handle(SaleroomFeed.bidderOf(event), SaleroomFeed.lotOf(event), SaleroomFeed.amountOf(event)),
      bidderOutbid: (event) => new CountBid(store).outbid(SaleroomFeed.outbidBidderOf(event), SaleroomFeed.lotOf(event)),
      lotSold: (event) => new CountBid(store).sold(SaleroomFeed.bidderOf(event), SaleroomFeed.amountOf(event)),
      lotUnsold: (event) => {
        const bidderId = SaleroomFeed.unsoldBidderOf(event);
        if (bidderId !== null) new CountBid(store).outbid(bidderId, SaleroomFeed.lotOf(event));
      },
    },
  };
}
