import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';
import type { StatementItem, StatementLog } from './StatementLog';

export class GetStatement {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly log: StatementLog,
  ) {}

  execute(accountId: string): StatementItem[] {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return this.log.newestFirst(account.id.value);
  }
}
