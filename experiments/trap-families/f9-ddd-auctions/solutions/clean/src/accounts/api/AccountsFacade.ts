import { SaleroomFeed } from '../acl/SaleroomFeed';
import { AccountCommands } from '../application/AccountCommands';
import { AccountQueries } from '../application/AccountQueries';
import { SaleroomReactions } from '../application/SaleroomReactions';
import type { AccountView } from '../contracts/AccountView';
import type { AccountStore } from '../domain/AccountStore';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';

export type { AccountView } from '../contracts/AccountView';
export type { AccountSuspendedMessage } from '../contracts/AccountMessages';

/** What the rest of the house may call on bidder accounts. */
export interface AccountsApi {
  register(name: string, creditLimit: number): string;
  account(accountId: string): AccountView | undefined;
  /** The finance desk sets credit aside, for example for a telephone or absentee bid. */
  holdCredit(accountId: string, ref: string, amount: number): void;
  releaseCredit(accountId: string, ref: string): void;
  suspend(accountId: string): void;
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
  const saleroom = new SaleroomReactions(store);
  return {
    register: (name, creditLimit) => commands.register(name, creditLimit),
    account: (accountId) => queries.view(accountId),
    holdCredit: (accountId, ref, amount) => commands.holdCredit(accountId, ref, amount),
    releaseCredit: (accountId, ref) => commands.releaseCredit(accountId, ref),
    suspend: (accountId) => commands.suspend(accountId),
    reactions: {
      bidPlaced: (event) => {
        const m = SaleroomFeed.bidPlaced(event);
        saleroom.bidLeads(m.bidderId, m.lotId, m.amount);
      },
      bidderOutbid: (event) => {
        const m = SaleroomFeed.bidderOutbid(event);
        saleroom.bidStoppedLeading(m.bidderId, m.lotId);
      },
      lotSold: (event) => {
        const m = SaleroomFeed.lotSold(event);
        saleroom.lotBought(m.buyerId, m.lotId, m.hammerPrice);
      },
      lotUnsold: (event) => {
        const m = SaleroomFeed.lotUnsold(event);
        if (m.lastLeaderId !== null) saleroom.bidStoppedLeading(m.lastLeaderId, m.lotId);
      },
    },
  };
}
