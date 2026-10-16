import { EventEmitter } from 'events';
import type { AccountRepository } from '../domain/account-repository';

export const appEvents = new EventEmitter();

export class GetBalance {
  constructor(private readonly accounts: AccountRepository) {}
  async run(id: string): Promise<number> {
    const a = await this.accounts.byId(id);
    appEvents.emit('balance.read', id);
    return a?.balance ?? 0;
  }
}
