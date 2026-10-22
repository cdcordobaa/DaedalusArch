import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import type { TransferSent } from '../domain/account/events/TransferSent';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class ReceiveTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const sent = event as TransferSent;
    const destination = this.accounts.byId(AccountId.of(sent.toAccountId));
    if (destination === undefined) throw new LedgerError(`no account ${sent.toAccountId}`);
    destination.receiveTransfer(sent.transferId, AccountId.of(sent.fromAccountId), Money.of(sent.cents / 100, sent.currency));
    this.accounts.save(destination);
  }
}
