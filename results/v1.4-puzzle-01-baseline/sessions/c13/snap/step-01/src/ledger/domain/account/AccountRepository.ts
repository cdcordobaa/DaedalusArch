import type { Account } from './Account';
import type { AccountId } from './value-objects/AccountId';

export interface AccountRepository {
  nextId(): AccountId;
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events in one step: all of them are stored or none. */
  saveAll(accounts: readonly Account[]): void;
}
