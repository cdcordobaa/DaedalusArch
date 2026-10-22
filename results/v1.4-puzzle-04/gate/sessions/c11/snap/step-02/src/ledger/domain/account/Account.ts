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
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentToday, state.sentCount, state.received);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
  }

  withdraw(amount: Money): void {
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
    this.withdraw(amount);
    this.sentDay = day;
    this.sentToday = total;
    this.sentCount += 1;
    this.pending.push(
      new TransferSent(`${this.id.value}#${this.sentCount}`, this.id.value, toAccountId, amount.cents, amount.currency),
    );
  }

  /** Credits an incoming transfer; a transfer id that was already applied is ignored. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.received.includes(transferId)) return;
    this.deposit(amount);
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
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
