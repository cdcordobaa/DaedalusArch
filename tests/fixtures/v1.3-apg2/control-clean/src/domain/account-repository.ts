import type { Account } from './account';
export interface AccountRepository {
  byId(id: string): Promise<Account | undefined>;
}
