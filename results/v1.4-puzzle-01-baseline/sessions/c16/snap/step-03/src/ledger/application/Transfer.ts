import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';
import type { StatementLog } from './StatementLog';

export const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

/** Cents transferred out per account on one calendar day; shared by every Transfer instance. */
export class DailyTransferTally {
  private readonly rows = new Map<string, { day: string; cents: number }>();

  sent(accountId: string, day: string): number {
    const row = this.rows.get(accountId);
    return row !== undefined && row.day === day ? row.cents : 0;
  }

  add(accountId: string, day: string, cents: number): void {
    this.rows.set(accountId, { day, cents: this.sent(accountId, day) + cents });
  }
}

export class Transfer {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly tally: DailyTransferTally,
    private readonly today: () => string,
    private readonly log: StatementLog,
  ) {}

  execute(fromAccountId: string, toAccountId: string, amount: number): void {
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    if (from === undefined) throw new LedgerError(`no account ${fromAccountId}`);
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (to === undefined) throw new LedgerError(`no account ${toAccountId}`);
    if (from.id.value === to.id.value) throw new LedgerError('cannot transfer to the same account');
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} vs ${to.currency}`);
    const money = Money.of(amount, from.currency);
    // Both mutations happen on private copies; nothing is stored unless both succeed.
    from.withdraw(money);
    to.deposit(money);
    const day = this.today();
    const left = DAILY_TRANSFER_LIMIT_CENTS - this.tally.sent(from.id.value, day);
    if (money.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(Math.max(left, 0) / 100, from.currency).format()} left today`);
    }
    this.accounts.saveAll([from, to]);
    this.tally.add(from.id.value, day, money.cents);
    this.log.record(from.id.value, { kind: 'transfer-out', amount: money.amount(), counterpart: to.id.value });
    this.log.record(to.id.value, { kind: 'transfer-in', amount: money.amount(), counterpart: from.id.value });
  }
}
