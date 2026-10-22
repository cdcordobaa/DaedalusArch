import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class Withdraw {
  constructor(private readonly accounts: AccountRepository) {}

  execute(accountId: string, amount: number): void {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    account.withdraw(Money.of(amount, account.currency));
    this.accounts.save(account);
  }
}
