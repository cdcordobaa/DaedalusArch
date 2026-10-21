import { Money } from '../../shared-kernel/Money';
import type { AccountRepository } from '../domain/account/AccountRepository';
import { AccountId } from '../domain/account/value-objects/AccountId';
import { LedgerError } from '../domain/LedgerError';

const DAILY_LIMIT_CENTS = 100000;

export class TransferMoney {
  constructor(private readonly accounts: AccountRepository) {}

  execute(fromAccountId: string, toAccountId: string, amount: number, day: string): void {
    const from = this.accounts.byId(AccountId.of(fromAccountId));
    const to = this.accounts.byId(AccountId.of(toAccountId));
    if (from === undefined || to === undefined) throw new LedgerError(`no account ${from === undefined ? fromAccountId : toAccountId}`);
    if (from.id.equals(to.id)) throw new LedgerError('a transfer needs two different accounts');
    if (from.currency !== to.currency) throw new LedgerError(`currency mismatch: ${from.currency} to ${to.currency}`);
    const money = Money.of(amount, from.currency);
    const left = DAILY_LIMIT_CENTS - this.accounts.sentOn(from.id, day);
    if (money.cents > left) throw new LedgerError(`daily transfer limit reached: ${from.currency} ${(left / 100).toFixed(2)} left today`);
    from.withdraw(money, 'transfer-out', to.id.value);
    to.deposit(money, 'transfer-in', from.id.value);
    this.accounts.save(from);
    this.accounts.save(to);
    this.accounts.recordSent(from.id, day, money.cents);
  }
}
