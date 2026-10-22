import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Takes the money out of the sending account; ReceiveTransfer credits the other one when the event is delivered. */
export class Transfer {
  constructor(private readonly accounts: AccountRepository) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    if (fromAccountId === toAccountId) throw new LedgerError('cannot transfer to the same account');
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    from.sendTransfer(this.accounts.nextTransferId(), to.id, Money.of(amount, from.currency));
    this.accounts.save(from);
  }
}
