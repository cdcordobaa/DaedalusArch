import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { AccountRepository } from '../domain/account/AccountRepository';
import type { MoneyTransferred } from '../domain/account/events/MoneyTransferred';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export class ReceiveTransfer {
  constructor(private readonly accounts: AccountRepository) {}

  handle(event: DomainEvent): void {
    const moved = event as MoneyTransferred;
    const account = this.accounts.byId(AccountId.of(moved.toAccountId));
    if (account === undefined) throw new LedgerError(`no account ${moved.toAccountId}`);
    account.receiveTransfer(moved.transferId, moved.amount);
    this.accounts.save(account);
  }
}
