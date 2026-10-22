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
  /** Day (YYYY-MM-DD) of the last transfer sent, and the total sent that day in cents. */
  readonly sentDay?: string;
  readonly sentCents?: number;
  /** Transfers sent so far, and ids of transfers already credited (for idempotent crediting). */
  readonly sentCount?: number;
  readonly receivedIds?: readonly string[];
}

export const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

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
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay ?? '', state.sentCents ?? 0, state.sentCount ?? 0, state.receivedIds ?? []);
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

  /** Sends a transfer: enforces the daily limit (plain withdrawals do not count) and records TransferSent. */
  sendTransfer(to: AccountId, amount: Money, day: string): void {
    const sentBefore = this.sentDay === day ? this.sentCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - sentBefore;
    if (amount.isPositive() && amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, this.currency).format()} left today`);
    }
    this.withdraw(amount);
    this.sentDay = day;
    this.sentCents = sentBefore + amount.cents;
    this.sentCount += 1;
    this.pending.push(new TransferSent(`${this.id.value}-T${this.sentCount}`, this.id.value, to.value, amount.cents, this.currency));
  }

  /** Credits a received transfer; a transfer already credited is ignored. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.receivedIds.includes(transferId)) return;
    this.deposit(amount);
    this.receivedIds = [...this.receivedIds, transferId];
  }

  state(): AccountState {
    return {
      id: this.id,
      owner: this.owner,
      currency: this.currency,
      balance: this.current,
      sentDay: this.sentDay,
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
