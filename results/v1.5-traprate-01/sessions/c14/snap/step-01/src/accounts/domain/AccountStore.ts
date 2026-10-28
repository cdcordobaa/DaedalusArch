import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BidderAccount } from './BidderAccount';

export interface AccountStore {
  newId(): string;
  find(id: string): BidderAccount | undefined;
  /** Writes the account and appends the events of the change to the outbox, in one step. */
  save(account: BidderAccount, events?: readonly DomainEvent[]): void;
}
