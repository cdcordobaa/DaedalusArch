import type { Movement } from '../domain/account/Account';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class GetStatement {
  constructor(private readonly accounts: AccountRepository) {}

  /** Every movement of the account, newest first. */
  execute(accountId: string): Movement[] {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return account.statement();
  }
}
