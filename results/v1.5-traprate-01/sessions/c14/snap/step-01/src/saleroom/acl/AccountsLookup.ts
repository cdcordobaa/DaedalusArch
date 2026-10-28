import type { AccountsApi } from '../../accounts/api/AccountsFacade';
import type { Bidders } from '../application/ports/Bidders';

/** Answers the saleroom's questions about bidders from what accounts publish. */
export class AccountsLookup implements Bidders {
  constructor(private readonly accounts: AccountsApi) {}

  isRegistered(bidderId: string): boolean {
    return this.accounts.account(bidderId) !== undefined;
  }

  creditAvailable(bidderId: string): number {
    return this.accounts.account(bidderId)?.creditAvailable ?? 0;
  }
}
