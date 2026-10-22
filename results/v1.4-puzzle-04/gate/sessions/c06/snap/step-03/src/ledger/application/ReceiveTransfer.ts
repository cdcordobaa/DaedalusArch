import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import type { TransferSent } from '../domain/account/events/TransferSent';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Credits the receiving account when a TransferSent event is delivered. Applying the same transfer twice has no effect. */
export class ReceiveTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const sent = event as TransferSent;
    const account = this.accounts.byId(AccountId.of(sent.toAccountId));
    if (account === undefined) throw new LedgerError(`no account ${sent.toAccountId}`);
    account.receiveTransfer(sent.transferId, Money.of(sent.cents / 100, sent.currency), sent.fromAccountId);
    this.accounts.save(account);
  }
}
