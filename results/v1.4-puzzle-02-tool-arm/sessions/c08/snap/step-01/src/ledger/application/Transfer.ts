import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Debits the sending account and records the transfer; ReceiveTransfer credits the other account. */
export class Transfer {
  private static counter = 0;

  constructor(private readonly accounts: AccountRepository) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    if (from.id.value === to.id.value) throw new LedgerError('cannot transfer to the same account');
    Transfer.counter += 1;
    from.sendTransfer(`T-${Transfer.counter}`, to.id, Money.of(amount, from.currency));
    this.accounts.save(from);
  }
}
