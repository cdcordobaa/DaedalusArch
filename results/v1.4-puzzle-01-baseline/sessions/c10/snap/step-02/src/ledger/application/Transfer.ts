import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

export const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

/** Cents transferred out per account on one calendar day. */
export type TransferTally = Map<string, { day: string; cents: number }>;

export class Transfer {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tally: TransferTally,
    private readonly today: () => string,
  ) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.id.value === to.id.value) throw new LedgerError('cannot transfer to the same account');
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    const money = Money.of(amount, from.currency);
    from.withdraw(money);
    const day = this.today();
    const entry = this.tally.get(from.id.value);
    const sent = entry !== undefined && entry.day === day ? entry.cents : 0;
    const left = DAILY_TRANSFER_LIMIT_CENTS - sent;
    if (money.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, from.currency).format()} left today`);
    }
    to.deposit(money);
    this.accounts.saveAll([from, to]);
    this.tally.set(from.id.value, { day, cents: sent + money.cents });
  }
}
