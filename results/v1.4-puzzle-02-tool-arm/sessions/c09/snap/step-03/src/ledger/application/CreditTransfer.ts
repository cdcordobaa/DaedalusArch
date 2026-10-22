import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Money } from '../../shared-kernel/Money';
import type { MoneyTransferred } from '../domain/account/events/MoneyTransferred';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Credits the receiving account once the sending account has stored a transfer. */
export class CreditTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const transfer = event as MoneyTransferred;
    const account = this.accounts.byId(AccountId.of(transfer.toAccountId));
    if (account === undefined) throw new LedgerError(`no account ${transfer.toAccountId}`);
    account.receiveTransfer(transfer.transferId, AccountId.of(transfer.fromAccountId), Money.of(transfer.cents / 100, transfer.currency));
    this.accounts.save(account);
  }
}
