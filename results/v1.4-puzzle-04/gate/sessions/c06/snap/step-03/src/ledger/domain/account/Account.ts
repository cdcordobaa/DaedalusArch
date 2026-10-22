import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { TransferSent } from './events/TransferSent';
import type { AccountId } from './value-objects/AccountId';

export type MovementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

export interface Movement {
  readonly kind: MovementKind;
  readonly cents: number;
  /** The other account of a transfer; null for deposits and withdrawals. */
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Ids of incoming transfers already credited. */
  readonly receivedTransfers?: readonly string[];
  /** Day (YYYY-MM-DD) of the last outgoing transfer and the cents sent on that day. */
  readonly sentDay?: string;
  readonly sentCents?: number;
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
    private readonly received: Set<string> = new Set(),
    private sentDay: string | undefined = undefined,
    private sentCents = 0,
    private readonly log: Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, new Set(state.receivedTransfers ?? []), state.sentDay, state.sentCents ?? 0, [...(state.movements ?? [])]);
  }

  get balance(): Money {
    return this.current;
  }

  get movements(): readonly Movement[] {
    return this.log;
  }

  deposit(amount: Money): void {
    this.credit(amount);
    this.log.push({ kind: 'deposit', cents: amount.cents, counterpart: null });
  }

  withdraw(amount: Money): void {
    this.debit(amount);
    this.log.push({ kind: 'withdrawal', cents: amount.cents, counterpart: null });
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

  /** Debits this account and records the event that makes the receiving account credit the same amount. */
  sendTransfer(transferId: string, to: AccountId, amount: Money, day: string): void {
    const sentSoFar = this.sentDay === day ? this.sentCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - sentSoFar;
    if (amount.isPositive() && amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, this.currency).format()} left today`);
    }
    this.debit(amount);
    this.log.push({ kind: 'transfer-out', cents: amount.cents, counterpart: to.value });
    this.sentDay = day;
    this.sentCents = sentSoFar + amount.cents;
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.cents, amount.currency));
  }

  receiveTransfer(transferId: string, amount: Money, from: string): void {
    if (this.received.has(transferId)) return;
    this.credit(amount);
    this.log.push({ kind: 'transfer-in', cents: amount.cents, counterpart: from });
    this.received.add(transferId);
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, receivedTransfers: [...this.received], sentDay: this.sentDay, sentCents: this.sentCents, movements: [...this.log] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
