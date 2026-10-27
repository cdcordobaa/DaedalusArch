import type { AccountsApi } from '../../accounts/api/AccountsFacade';
import type { Bidders } from '../application/ports/Bidders';
import type { BidderStanding } from '../domain/Lot';

/** Answers the saleroom's questions about bidders from what accounts publish. */
export class AccountsLookup implements Bidders {
  constructor(private readonly accounts: AccountsApi) {}

  standing(bidderId: string): BidderStanding | undefined {
    const view = this.accounts.account(bidderId);
    return view === undefined ? undefined : { creditAvailable: view.creditAvailable, suspended: view.status === 'suspended' };
  }
}
