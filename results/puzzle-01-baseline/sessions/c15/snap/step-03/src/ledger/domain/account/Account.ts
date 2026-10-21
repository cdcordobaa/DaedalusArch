import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export type MovementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

export interface Movement {
  readonly kind: MovementKind;
  readonly amount: Money;
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Day (YYYY-MM-DD) the transfer total below belongs to. */
  readonly transferDay?: string;
  readonly transferredOnDay?: Money;
  /** Every movement, oldest first. */
  readonly movements?: readonly Movement[];
}

const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private transferDay?: string,
    private transferredOnDay?: Money,
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.transferDay, state.transferredOnDay, state.movements);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.movements = [...this.movements, { kind: 'deposit', amount, counterpart: null }];
  }

  /** Receives an incoming transfer from the account `from`. */
  receiveTransfer(amount: Money, from: string): void {
    this.deposit(amount);
    this.record('transfer-in', amount, from);
  }

  withdraw(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
    this.movements = [...this.movements, { kind: 'withdrawal', amount, counterpart: null }];
  }

  /** Re-labels the latest movement, which a transfer has just recorded as a plain deposit or withdrawal. */
  private record(kind: MovementKind, amount: Money, counterpart: string): void {
    this.movements = [...this.movements.slice(0, -1), { kind, amount, counterpart }];
  }

  /** Movements, newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  /** Withdraws for an outgoing transfer, enforcing the daily transfer limit. `day` is YYYY-MM-DD. */
  withdrawForTransfer(amount: Money, day: string, to: string): void {
    const sent = this.transferDay === day && this.transferredOnDay !== undefined ? this.transferredOnDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT_CENTS / 100, this.currency).minus(sent);
    if (amount.isPositive() && amount.minus(left).isPositive()) {
      throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    }
    this.withdraw(amount);
    this.record('transfer-out', amount, to);
    this.transferDay = day;
    this.transferredOnDay = sent.plus(amount);
  }

  state(): AccountState {
    return {
      id: this.id,
      owner: this.owner,
      currency: this.currency,
      balance: this.current,
      transferDay: this.transferDay,
      transferredOnDay: this.transferredOnDay,
      movements: this.movements,
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
