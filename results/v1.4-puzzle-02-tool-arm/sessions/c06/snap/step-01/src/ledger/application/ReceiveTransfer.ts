import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import type { TransferSent } from '../domain/account/events/TransferSent';
import { LedgerError } from '../domain/LedgerError';

/** Credits the receiving account of a transfer that the sending account has stored. */
export class ReceiveTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: TransferSent): void {
    const account = this.accounts.byId(AccountId.of(event.toAccountId));
    if (account === undefined) throw new LedgerError(`no account ${event.toAccountId}`);
    account.receiveTransfer(event.transferId, Money.of(event.cents / 100, event.currency));
    this.accounts.save(account);
  }
}
