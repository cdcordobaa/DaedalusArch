import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class GetBalance {
  constructor(private readonly accounts: AccountRepository) {}

  execute(accountId: string): number {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return account.balance.amount();
  }
}
