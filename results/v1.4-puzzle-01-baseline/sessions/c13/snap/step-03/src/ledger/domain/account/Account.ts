import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export interface Movement {
  readonly kind: 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';
  readonly amount: Money;
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Day (YYYY-MM-DD) of the last transfer sent, and the total sent on that day. */
  readonly sentDay?: string;
  readonly sentOnDay?: Money;
  /** Movements in the order they happened (oldest first). */
  readonly movements?: readonly Movement[];
}

const DAILY_TRANSFER_LIMIT = 1000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private sentDay?: string,
    private sentOnDay?: Money,
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentOnDay, state.movements);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.record('deposit', amount, null);
  }

  /** Receives the money of a transfer sent by account `from`. */
  depositFromTransfer(amount: Money, from: AccountId): void {
    this.deposit(amount);
    this.movements = [...this.movements.slice(0, -1), { kind: 'transfer-in', amount, counterpart: from.value }];
  }

  withdraw(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
    this.record('withdrawal', amount, null);
  }

  /** Withdraws for a transfer, counting it against the daily transfer limit of `day` (YYYY-MM-DD). */
  withdrawForTransfer(amount: Money, day: string, to: AccountId): void {
    const sent = this.sentDay === day && this.sentOnDay !== undefined ? this.sentOnDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT, this.currency).minus(sent);
    if (amount.minus(left).isPositive()) {
      throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    }
    this.withdraw(amount);
    this.movements = [...this.movements.slice(0, -1), { kind: 'transfer-out', amount, counterpart: to.value }];
    this.sentDay = day;
    this.sentOnDay = sent.plus(amount);
  }

  state(): AccountState {
    return {
      id: this.id,
      owner: this.owner,
      currency: this.currency,
      balance: this.current,
      sentDay: this.sentDay,
      sentOnDay: this.sentOnDay,
      movements: this.movements,
    };
  }

  /** Movements, newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  private record(kind: Movement['kind'], amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount, counterpart }];
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
