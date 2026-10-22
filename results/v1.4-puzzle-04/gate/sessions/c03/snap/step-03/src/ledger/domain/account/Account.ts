import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { TransferSent } from './events/TransferSent';
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
  /** Day (YYYY-MM-DD) of the last transfer and the cents sent that day. */
  readonly sentDay?: string;
  readonly sentCents?: number;
  /** Every movement, oldest first. */
  readonly movements?: readonly Movement[];
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
    private movements: Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay ?? '', state.sentCents ?? 0, [...(state.movements ?? [])]);
  }

  get balance(): Money {
    return this.current;
  }

  /** Newest first. */
  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  /** `from` is set when the money arrives from another account's transfer. */
  deposit(amount: Money, from?: AccountId): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.movements.push({ kind: from === undefined ? 'deposit' : 'transfer-in', amount: amount.amount(), counterpart: from?.value ?? null });
  }

  withdraw(amount: Money): void {
    this.debit(amount);
    this.movements.push({ kind: 'withdrawal', amount: amount.amount(), counterpart: null });
  }

  private debit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
  }

  /** Takes the money out and records that it is on its way to another account. */
  sendTransfer(transferId: string, to: AccountId, amount: Money, today: string): void {
    const used = this.sentDay === today ? this.sentCents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - used;
    if (amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, this.currency).format()} left today`);
    }
    this.debit(amount);
    this.movements.push({ kind: 'transfer-out', amount: amount.amount(), counterpart: to.value });
    this.sentDay = today;
    this.sentCents = used + amount.cents;
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.amount(), this.currency));
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sentDay: this.sentDay, sentCents: this.sentCents, movements: [...this.movements] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
