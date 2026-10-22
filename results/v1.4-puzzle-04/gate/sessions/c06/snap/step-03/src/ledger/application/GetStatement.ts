import type { MovementKind } from '../domain/account/Account';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export interface StatementItem {
  readonly kind: MovementKind;
  readonly amount: number;
  readonly counterpart: string | null;
}

/** Every movement of an account, newest first. */
export class GetStatement {
  constructor(private readonly accounts: AccountRepository) {}

  execute(accountId: string): StatementItem[] {
    const account = this.accounts.byId(AccountId.of(accountId));
    if (account === undefined) throw new LedgerError(`no account ${accountId}`);
    return account.movements
      .map((m) => ({ kind: m.kind, amount: m.cents / 100, counterpart: m.counterpart }))
      .reverse();
  }
}
