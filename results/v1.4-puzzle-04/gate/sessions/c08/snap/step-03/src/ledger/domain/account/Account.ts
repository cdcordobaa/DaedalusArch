import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { TransferSent } from './events/TransferSent';
import type { AccountId } from './value-objects/AccountId';

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  readonly sentDay?: string;
  readonly sentCents?: number;
  readonly sentCount?: number;
  readonly receivedIds?: readonly string[];
  readonly movements?: readonly Movement[];
}

export interface Movement {
  readonly kind: 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';
  readonly amount: number;
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
    private sentDay: string = '',
    private sentCents: number = 0,
    private sentCount: number = 0,
    private receivedIds: readonly string[] = [],
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentCents, state.sentCount, state.receivedIds, state.movements);
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

  private record(kind: Movement['kind'], amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount: amount.amount(), counterpart }];
  }

  /** Credits an incoming transfer once; a repeated transfer id is ignored. */
  receiveTransfer(transferId: string, amount: Money, from: string): void {
    if (this.receivedIds.includes(transferId)) return;
    this.credit(amount);
    this.record('transfer-in', amount, from);
    this.receivedIds = [...this.receivedIds, transferId];
  }

  /** Withdraws for an outgoing transfer, enforcing the daily transfer limit, and records TransferSent. `day` is YYYY-MM-DD. */
  withdrawForTransfer(to: AccountId, amount: Money, day: string): void {
    const used = this.sentDay === day ? this.sentCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - used;
    if (amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, this.currency).format()} left today`);
    }
    this.debit(amount);
    this.record('transfer-out', amount, to.value);
    this.sentDay = day;
    this.sentCents = used + amount.cents;
    this.sentCount += 1;
    this.pending.push(new TransferSent(`${this.id.value}#${this.sentCount}`, to.value, amount.cents, amount.currency, this.id.value));
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sentDay: this.sentDay,
      sentCents: this.sentCents,
      sentCount: this.sentCount,
      receivedIds: this.receivedIds,
      movements: this.movements,
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
