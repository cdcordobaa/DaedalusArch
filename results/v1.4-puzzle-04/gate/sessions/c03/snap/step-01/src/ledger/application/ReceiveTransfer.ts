import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import type { TransferSent } from '../domain/account/events/TransferSent';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

/** Credits the receiving account of a transfer, once per transfer. */
export class ReceiveTransfer {
  private readonly applied = new Set<string>();

  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const sent = event as TransferSent;
    if (this.applied.has(sent.transferId)) return;
    const account = this.accounts.byId(AccountId.of(sent.toAccountId));
    if (account === undefined) throw new LedgerError(`no account ${sent.toAccountId}`);
    account.deposit(Money.of(sent.amount, sent.currency));
    this.accounts.save(account);
    this.applied.add(sent.transferId);
  }
}
