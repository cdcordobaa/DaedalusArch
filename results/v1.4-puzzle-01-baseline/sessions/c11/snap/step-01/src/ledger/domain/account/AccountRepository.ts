import type { Account } from './Account';
import type { AccountId } from './value-objects/AccountId';

export interface AccountRepository {
  nextId(): AccountId;
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores several accounts and their pending events together: all of them or none. */
  saveAll(accounts: Account[]): void;
}
