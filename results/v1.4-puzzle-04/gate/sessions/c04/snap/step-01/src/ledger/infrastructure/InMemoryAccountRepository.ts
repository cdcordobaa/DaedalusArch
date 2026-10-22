import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';
import { Account, type AccountState } from '../domain/account/Account';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';

/** Accounts and their outbox in one store: saving an account stores its pending events in the same step. */
export class InMemoryAccountRepository implements AccountRepository, Outbox {
  private readonly rows = new Map<string, AccountState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): AccountId {
    this.sequence += 1;
    return AccountId.of(`A-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: AccountId): Account | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Account.restore(row);
  }

  save(account: Account): void {
    const events = account.pullEvents();
    this.rows.set(account.id.value, account.state());
    this.outbox = [...this.outbox, ...events];
  }

  saveAll(accounts: readonly Account[]): void {
    const states = accounts.map((account) => account.state());
    const events = accounts.flatMap((account) => account.pullEvents());
    states.forEach((state) => this.rows.set(state.id.value, state));
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
