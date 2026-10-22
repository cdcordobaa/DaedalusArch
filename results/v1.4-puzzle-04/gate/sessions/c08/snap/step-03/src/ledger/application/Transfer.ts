import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class Transfer {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly today: () => string,
  ) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    if (fromAccountId === toAccountId) throw new LedgerError('cannot transfer to the same account');
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.currency !== to.currency) {
      throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    }
    const money = Money.of(amount, from.currency);
    from.withdrawForTransfer(to.id, money, this.today());
    this.accounts.save(from);
  }
}
