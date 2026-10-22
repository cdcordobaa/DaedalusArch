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
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentCents, state.sentCount, state.receivedIds);
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

  /** Credits an incoming transfer once; a repeated transfer id is ignored. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.receivedIds.includes(transferId)) return;
    this.deposit(amount);
    this.receivedIds = [...this.receivedIds, transferId];
  }

  /** Withdraws for an outgoing transfer, enforcing the daily transfer limit, and records TransferSent. `day` is YYYY-MM-DD. */
  withdrawForTransfer(to: AccountId, amount: Money, day: string): void {
    const used = this.sentDay === day ? this.sentCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - used;
    if (amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, this.currency).format()} left today`);
    }
    this.withdraw(amount);
    this.sentDay = day;
    this.sentCents = used + amount.cents;
    this.sentCount += 1;
    this.pending.push(new TransferSent(`${this.id.value}#${this.sentCount}`, to.value, amount.cents, amount.currency));
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sentDay: this.sentDay,
      sentCents: this.sentCents,
      sentCount: this.sentCount,
      receivedIds: this.receivedIds,
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
