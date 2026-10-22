import type { Account } from './Account';
import type { AccountId } from './value-objects/AccountId';

export interface AccountRepository {
  nextId(): AccountId;
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  sentOn(accountId: AccountId, day: string): number;
  recordSent(accountId: AccountId, day: string, cents: number): void;
}
