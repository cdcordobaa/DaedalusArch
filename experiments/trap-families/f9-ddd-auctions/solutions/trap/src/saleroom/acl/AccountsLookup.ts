import type { AccountsApi } from '../../accounts/api/AccountsFacade';
import type { Bidders } from '../application/ports/Bidders';

/** Answers the saleroom's questions about bidders from what accounts publish. */
export class AccountsLookup implements Bidders {
  constructor(private readonly accounts: AccountsApi) {}

  isRegistered(bidderId: string): boolean {
    return this.accounts.account(bidderId) !== undefined;
  }

  isSuspended(bidderId: string): boolean {
    return this.accounts.account(bidderId)?.status === 'suspended';
  }

  holdCredit(bidderId: string, ref: string, amount: number): void {
    this.accounts.holdCredit(bidderId, ref, amount);
  }

  releaseCredit(bidderId: string, ref: string): void {
    this.accounts.releaseCredit(bidderId, ref);
  }

  recordPurchase(bidderId: string, lotId: string, hammerPrice: number): void {
    this.accounts.recordPurchase(bidderId, lotId, hammerPrice);
  }
}
