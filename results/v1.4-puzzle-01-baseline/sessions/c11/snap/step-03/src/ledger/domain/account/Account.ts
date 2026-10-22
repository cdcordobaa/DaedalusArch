import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export type MovementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

export interface Movement {
  readonly kind: MovementKind;
  readonly amount: number;
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Day (YYYY-MM-DD) that `sentOnDay` counts transfers for. */
  readonly sentDay?: string;
  readonly sentOnDay?: Money;
  /** Movements in the order they happened (oldest first). */
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
    private sentDay: string = '',
    private sentOnDay: Money = Money.zero(currency),
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
    this.credit(amount);
    this.record('deposit', amount, null);
  }

  withdraw(amount: Money): void {
    this.debit(amount);
    this.record('withdrawal', amount, null);
  }

  /** Receives the money of a transfer sent by account `from`. */
  receiveTransfer(amount: Money, from: AccountId): void {
    this.credit(amount);
    this.record('transfer-in', amount, from.value);
  }

  /** Every movement, newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  private credit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
  }

  private debit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
  }

  private record(kind: MovementKind, amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount: amount.amount(), counterpart }];
  }

  /** Withdraws as part of a transfer, enforcing the daily transfer limit for `day` (YYYY-MM-DD). */
  sendTransfer(amount: Money, day: string, to: AccountId): void {
    const sofar = this.sentDay === day ? this.sentOnDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT_CENTS / 100, this.currency).minus(sofar);
    if (amount.isPositive() && amount.cents > left.cents) {
      throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    }
    this.debit(amount);
    this.record('transfer-out', amount, to.value);
    this.sentDay = day;
    this.sentOnDay = sofar.plus(amount);
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

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
