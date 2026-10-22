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
  /** Day (YYYY-MM-DD) that `sentToday` refers to. */
  readonly sentDay?: string;
  /** Amount sent by transfer on `sentDay`. */
  readonly sentToday?: Money;
  /** Number of transfers sent; makes transfer ids unique per account. */
  readonly sentCount?: number;
  /** Ids of incoming transfers already applied. */
  readonly received?: readonly string[];
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
    private sentDay: string = '',
    private sentToday: Money = Money.zero(currency),
    private sentCount: number = 0,
    private received: readonly string[] = [],
    private movements: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentToday, state.sentCount, state.received, state.movements);
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

  /** Movements newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  private record(kind: Movement['kind'], amount: Money, counterpart: string | null): void {
    this.movements = [...this.movements, { kind, amount, counterpart }];
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

  /**
   * Withdraws for an outgoing transfer, enforcing the daily transfer limit, and records
   * TransferSent so the receiving account is credited by a handler. `day` is YYYY-MM-DD.
   */
  sendTransfer(amount: Money, day: string, toAccountId: string): void {
    const sent = this.sentDay === day ? this.sentToday : Money.zero(this.currency);
    const total = sent.plus(amount);
    const limit = Money.of(DAILY_TRANSFER_LIMIT_CENTS / 100, this.currency);
    if (amount.isPositive() && total.minus(limit).isPositive()) {
      throw new LedgerError(`daily transfer limit reached: ${limit.minus(sent).format()} left today`);
    }
    this.debit(amount);
    this.record('transfer-out', amount, toAccountId);
    this.sentDay = day;
    this.sentToday = total;
    this.sentCount += 1;
    this.pending.push(
      new TransferSent(`${this.id.value}#${this.sentCount}`, this.id.value, toAccountId, amount.cents, amount.currency),
    );
  }

  /** Credits an incoming transfer; a transfer id that was already applied is ignored. */
  receiveTransfer(transferId: string, amount: Money, fromAccountId: string): void {
    if (this.received.includes(transferId)) return;
    this.credit(amount);
    this.record('transfer-in', amount, fromAccountId);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return {
      id: this.id,
      owner: this.owner,
      currency: this.currency,
      balance: this.current,
      sentDay: this.sentDay,
      sentToday: this.sentToday,
      sentCount: this.sentCount,
      received: this.received,
      movements: this.movements,
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
