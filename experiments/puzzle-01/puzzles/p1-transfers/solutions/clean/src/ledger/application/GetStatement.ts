import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export interface StatementLine {
  readonly kind: string;
  readonly amount: number;
  readonly counterpart: string | null;
}

export class GetStatement {
  constructor(private readonly accounts: AccountRepository) {}

  execute(accountId: string): StatementLine[] {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return account.statement().map((m) => ({ kind: m.kind, amount: m.cents / 100, counterpart: m.counterpart }));
  }
}
