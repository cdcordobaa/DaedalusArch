import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { MoneyTransferred } from './events/MoneyTransferred';
import type { AccountId } from './value-objects/AccountId';

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Transfers this account has sent. */
  readonly sent?: number;
  /** Ids of incoming transfers already applied. */
  readonly received?: readonly string[];
  /** Day (YYYY-MM-DD) of the transfers counted in sentTodayCents. */
  readonly sentDay?: string;
  /** Cents sent by transfer on sentDay. */
  readonly sentTodayCents?: number;
  /** Every movement, oldest first. */
  readonly movements?: readonly Movement[];
}

export interface Movement {
  readonly kind: 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';
  readonly amount: Money;
  readonly counterpart: string | null;
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
    private sent: number = 0,
    private received: readonly string[] = [],
    private sentDay: string = '',
    private sentTodayCents: number = 0,
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sent ?? 0, state.received ?? [], state.sentDay ?? '', state.sentTodayCents ?? 0, state.movements ?? []);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.credit(amount);
    this.record('deposit', amount, null);
  }

  private credit(amount: Money): void {
    this.current = this.current.plus(amount);
  }

  private record(kind: Movement['kind'], amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount, counterpart }];
  }

  /** Movements newest first. */
  statement(): readonly Movement[] {
    return [...this.movements].reverse();
  }

  withdraw(amount: Money): void {
    this.debit(amount);
    this.record('withdrawal', amount, null);
  }

  private debit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
  }

  /** Takes the money out and records the transfer; the receiving account applies it on the event. */
  transferOut(amount: Money, to: AccountId, day: string): void {
    const used = this.sentDay === day ? this.sentTodayCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - used;
    if (amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, this.currency).format()} left today`);
    }
    this.debit(amount);
    this.record('transfer-out', amount, to.value);
    this.sentDay = day;
    this.sentTodayCents = used + amount.cents;
    this.sent += 1;
    this.pending.push(new MoneyTransferred(`${this.id.value}#${this.sent}`, this.id.value, to.value, amount));
  }

  /** Applies an incoming transfer once; a repeated delivery changes nothing. */
  receiveTransfer(transferId: string, amount: Money, from: string): void {
    if (this.received.includes(transferId)) return;
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.credit(amount);
    this.record('transfer-in', amount, from);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sent: this.sent, received: this.received, sentDay: this.sentDay, sentTodayCents: this.sentTodayCents, movements: this.movements };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
