import type { Account } from './Account.js';

export interface AccountRepository {
  byId(id: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}
