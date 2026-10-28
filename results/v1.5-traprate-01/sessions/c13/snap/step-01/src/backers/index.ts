import { BackerAccounts } from './application/BackerAccounts';
import { ProfileQuery } from './application/ProfileQuery';
import type { BackerProfile } from './contracts/BackerProfile';
import type { BackerRepository } from './domain/backer/BackerRepository';
import { InMemoryBackerRepository } from './infrastructure/InMemoryBackerRepository';

export type { BackerProfile } from './contracts/BackerProfile';

/** The only way into backer accounts from elsewhere on the platform. */
export class BackersFacade {
  private readonly accounts: BackerAccounts;
  private readonly profiles: ProfileQuery;

  constructor(store: BackerRepository = new InMemoryBackerRepository()) {
    this.accounts = new BackerAccounts(store);
    this.profiles = new ProfileQuery(store);
  }

  register(handle: string): string {
    return this.accounts.register(handle);
  }

  recordPastBackings(backerId: string, amount: number): void {
    this.accounts.recordPastBackings(backerId, amount);
  }

  recordMissedPayment(backerId: string): void {
    this.accounts.recordMissedPayment(backerId);
  }

  profile(backerId: string): BackerProfile | undefined {
    return this.profiles.profile(backerId);
  }
}
