import { AccountsError } from '../domain/AccountsError';
import { BidderAccount } from '../domain/BidderAccount';
import type { AccountStore } from '../domain/AccountStore';

export class AccountCommands {
  constructor(private readonly store: AccountStore) {}

  register(name: string, creditLimit: number): string {
    const [account, events] = BidderAccount.register(this.store.newId(), name, creditLimit);
    this.store.save(account, events);
    return account.id;
  }

  holdCredit(accountId: string, ref: string, amount: number): void {
    const account = this.load(accountId);
    account.holdCredit(ref, amount);
    this.store.save(account);
  }

  releaseCredit(accountId: string, ref: string): void {
    const account = this.load(accountId);
    account.releaseCredit(ref);
    this.store.save(account);
  }

  recordPurchase(accountId: string, lotId: string, hammerPrice: number): void {
    const account = this.load(accountId);
    account.recordPurchase(`lot:${lotId}`, lotId, hammerPrice);
    this.store.save(account);
  }

  suspend(accountId: string): void {
    const account = this.load(accountId);
    account.suspend();
    this.store.save(account);
  }

  private load(accountId: string): BidderAccount {
    const account = this.store.find(accountId);
    if (account === undefined) throw new AccountsError(`no account ${accountId}`);
    return account;
  }
}
