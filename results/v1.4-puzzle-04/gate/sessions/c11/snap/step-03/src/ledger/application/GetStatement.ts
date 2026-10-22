import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export interface StatementItem {
  readonly kind: 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';
  readonly amount: number;
  readonly counterpart: string | null;
}

export class GetStatement {
  constructor(private readonly accounts: AccountRepository) {}

  execute(accountId: string): StatementItem[] {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return account.statement().map((m) => ({ kind: m.kind, amount: m.amount.amount(), counterpart: m.counterpart }));
  }
}
