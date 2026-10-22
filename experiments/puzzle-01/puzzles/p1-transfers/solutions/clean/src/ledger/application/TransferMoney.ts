import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Takes the money out of the source account; `ReceiveTransfer` credits the destination when the event is delivered. */
export class TransferMoney {
  constructor(private readonly accounts: AccountRepository) {}

  execute(fromAccountId: string, toAccountId: string, amount: number, day: string): string {
    const source = this.accounts.byId(AccountId.of(fromAccountId));
    if (source === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const destination = this.accounts.byId(AccountId.of(toAccountId));
    if (destination === undefined) throw new LedgerError(`no account ${toAccountId}`);
    const transferId = this.accounts.nextTransferId();
    source.sendTransfer(transferId, destination.id, destination.currency, Money.of(amount, source.currency), day);
    this.accounts.save(source);
    return transferId;
  }
}
