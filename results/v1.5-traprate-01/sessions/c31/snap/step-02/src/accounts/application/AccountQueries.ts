import type { AccountView } from '../contracts/AccountView';
import type { AccountStore } from '../domain/AccountStore';

export class AccountQueries {
  constructor(private readonly store: AccountStore) {}

  view(accountId: string): AccountView | undefined {
    const account = this.store.find(accountId);
    if (account === undefined) return undefined;
    const r = account.toRecord();
    return { id: r.id, name: r.name, creditLimit: r.creditLimit, creditAvailable: account.creditAvailable(), bidsPlaced: r.bidsPlaced, amountOwed: r.amountOwed, status: r.status };
  }
}
