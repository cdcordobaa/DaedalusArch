import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import type { TransferSent } from '../domain/account/events/TransferSent';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Credits the receiving account of a transfer; applying the same event twice has no further effect. */
export class ReceiveTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const sent = event as TransferSent;
    const to = this.accounts.byId(AccountId.of(sent.toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${sent.toAccountId}`);
    to.receiveTransfer(sent.transferId, Money.of(sent.cents / 100, sent.currency), sent.fromAccountId);
    this.accounts.save(to);
  }
}
