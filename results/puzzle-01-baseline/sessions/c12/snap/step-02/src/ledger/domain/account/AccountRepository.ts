import type { Account } from './Account';
import type { AccountId } from './value-objects/AccountId';

export interface AccountRepository {
  nextId(): AccountId;
  byId(id: AccountId): Account | undefined;
  /** Stores the account and its pending events in one step. */
  save(account: Account): void;
  /** Stores all the accounts and their pending events together, or none of them. */
  saveAll(accounts: readonly Account[]): void;
}
