import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class Transfer {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.id.value === to.id.value) throw new LedgerError('cannot transfer to the same account');
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    const money = Money.of(amount, from.currency);
    from.sendTransfer(money, this.today());
    to.deposit(money);
    this.accounts.saveAll([from, to]);
  }
}
