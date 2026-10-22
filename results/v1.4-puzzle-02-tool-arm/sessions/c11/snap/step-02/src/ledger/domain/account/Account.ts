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
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.receivedTransfers ?? [], state.sentDay, state.sentOnDay ?? Money.zero(state.currency));
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

  /** Takes the money out and records the event that lets the receiving account be credited. */
  sendTransfer(transferId: string, to: AccountId, amount: Money, day: string): void {
    const sentSoFar = this.sentDay === day ? this.sentOnDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT_CENTS / 100, this.currency).minus(sentSoFar);
    if (amount.minus(left).isPositive()) throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    this.withdraw(amount);
    this.sentDay = day;
    this.sentOnDay = sentSoFar.plus(amount);
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.cents, amount.currency));
  }

  /** Credits a transfer once; a repeated delivery of the same transfer is ignored. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.received.includes(transferId)) return;
    this.deposit(amount);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, receivedTransfers: this.received, sentDay: this.sentDay, sentOnDay: this.sentOnDay };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
