import type { Outbox } from '../../plumbing/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { AccountStore } from '../domain/AccountStore';
import { BidderAccount, type AccountRecord } from '../domain/BidderAccount';

export class InMemoryAccountStore implements AccountStore {
  private readonly rows = new Map<string, AccountRecord>();
  private paddles = 100;

  constructor(private readonly outbox: Outbox) {}

  newId(): string {
    this.paddles += 1;
    return `P-${String(this.paddles)}`;
  }

  find(id: string): BidderAccount | undefined {
    const row = this.rows.get(id);
    return row === undefined ? undefined : BidderAccount.fromRecord(row);
  }

  save(account: BidderAccount, events: readonly DomainEvent[] = []): void {
    this.rows.set(account.id, account.toRecord());
    this.outbox.append(events);
  }
}
