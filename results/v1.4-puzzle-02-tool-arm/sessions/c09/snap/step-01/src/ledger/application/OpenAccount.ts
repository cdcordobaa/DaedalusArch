import { Account } from '../domain/account/Account';
import type { AccountRepository } from '../domain/account/AccountRepository';

export class OpenAccount {
  constructor(private readonly accounts: AccountRepository) {}

  execute(owner: string, currency: string): string {
    const account = Account.open(this.accounts.nextId(), owner, currency);
    this.accounts.save(account);
    return account.id.value;
  }
}
