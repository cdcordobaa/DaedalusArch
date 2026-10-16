import { Pool } from 'pg';
import { Account } from '../domain/account';
import type { AccountRepository } from '../domain/account-repository';

export class SqlAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}
  async byId(id: string): Promise<Account | undefined> {
    const r = await this.pool.query('select balance from accounts where id = $1', [id]);
    const row = r.rows[0] as { balance: number } | undefined;
    return row === undefined ? undefined : new Account(id, row.balance);
  }
}
