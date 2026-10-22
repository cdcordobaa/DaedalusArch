import type { AccountRepository } from '../domain/account/AccountRepository.js';

/** Subscriber: relayed from ordering's outbox; billing changes its own aggregate in its own transaction. */
export class OnOrderPlaced {
  constructor(private readonly accounts: AccountRepository) {}

  async handle(event: { readonly orderId: string; readonly totalCents: number; readonly accountId: string }): Promise<void> {
    const account = await this.accounts.byId(event.accountId);
    if (account === null) throw new Error('Unknown account');
    account.charge(event.totalCents);
    await this.accounts.save(account);
  }
}
