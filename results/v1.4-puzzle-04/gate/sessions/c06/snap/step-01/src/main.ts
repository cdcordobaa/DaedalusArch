import { Deposit } from './ledger/application/Deposit';
import { EventRelay } from './ledger/application/EventRelay';
import { GetBalance } from './ledger/application/GetBalance';
import { OpenAccount } from './ledger/application/OpenAccount';
import { ReceiveTransfer } from './ledger/application/ReceiveTransfer';
import { SendWelcomeNotice } from './ledger/application/SendWelcomeNotice';
import { Transfer } from './ledger/application/Transfer';
import { Withdraw } from './ledger/application/Withdraw';
import { InMemoryAccountRepository } from './ledger/infrastructure/InMemoryAccountRepository';
import { InMemoryNotices } from './ledger/infrastructure/InMemoryNotices';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp(options: AppOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const accounts = new InMemoryAccountRepository();
  const notices = new InMemoryNotices();
  const relay = new EventRelay(accounts);
  const welcome = new SendWelcomeNotice(notices);
  relay.on('AccountOpened', (e) => welcome.handle(e));
  const receive = new ReceiveTransfer(accounts);
  relay.on('TransferSent', (e) => receive.handle(e));
  const command =<T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    openAccount: (owner: string, currency: string): string => command(() => new OpenAccount(accounts).execute(owner, currency)),
    deposit: (accountId: string, amount: number): void => command(() => new Deposit(accounts).execute(accountId, amount)),
    withdraw: (accountId: string, amount: number): void => command(() => new Withdraw(accounts).execute(accountId, amount)),
    transfer: (fromAccountId: string, toAccountId: string, amount: number): void =>
      command(() => new Transfer(accounts).execute(fromAccountId, toAccountId, amount)),
    balanceOf: (accountId: string): number => new GetBalance(accounts).execute(accountId),
    notices: (): string[] => notices.all(),
  };
}
