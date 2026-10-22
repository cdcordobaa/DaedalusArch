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
  readonly receivedTransfers?: readonly string[];
  readonly sentDay?: string;
  readonly sentOnDay?: Money;
  readonly movements?: readonly Movement[];
}

export interface Movement {
  readonly kind: 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';
  readonly amount: number;
  readonly counterpart: string | null;
}

/** The most an account may send by transfer per calendar day, in cents. */
const DAILY_TRANSFER_LIMIT_CENTS = 100000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private received: readonly string[] = [],
    private sentDay: string | undefined = undefined,
    private sentOnDay: Money = Money.zero(currency),
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.receivedTransfers ?? [], state.sentDay, state.sentOnDay ?? Money.zero(state.currency), state.movements ?? []);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    this.credit(amount);
    this.record('deposit', amount, null);
  }

  /** Every movement, newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  private credit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
  }

  private record(kind: Movement['kind'], amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount: amount.amount(), counterpart }];
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

  /** Takes the money out and records the event that lets the receiving account be credited. */
  sendTransfer(transferId: string, to: AccountId, amount: Money, day: string): void {
    const sentSoFar = this.sentDay === day ? this.sentOnDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT_CENTS / 100, this.currency).minus(sentSoFar);
    if (amount.minus(left).isPositive()) throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    this.debit(amount);
    this.record('transfer-out', amount, to.value);
    this.sentDay = day;
    this.sentOnDay = sentSoFar.plus(amount);
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.cents, amount.currency));
  }

  /** Credits a transfer once; a repeated delivery of the same transfer is ignored. */
  receiveTransfer(transferId: string, amount: Money, from: AccountId): void {
    if (this.received.includes(transferId)) return;
    this.credit(amount);
    this.record('transfer-in', amount, from.value);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, receivedTransfers: this.received, sentDay: this.sentDay, sentOnDay: this.sentOnDay, movements: this.movements };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
