import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';
import type { StatementLog } from './StatementLog';

export class Deposit {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly log: StatementLog,
  ) {}

  execute(accountId: string, amount: number): void {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    const money = Money.of(amount, account.currency);
    account.deposit(money);
    this.accounts.save(account);
    this.log.record(account.id.value, { kind: 'deposit', amount: money.amount(), counterpart: null });
  }
}
