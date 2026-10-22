/**
 * P1 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../tools/run-tests';

interface App {
  openAccount(owner: string, currency: string): string;
  deposit(id: string, amount: number): void;
  withdraw(id: string, amount: number): void;
  balanceOf(id: string): number;
  notices(): string[];
  transfer(from: string, to: string, amount: number): unknown;
  statement(id: string): { kind: string; amount: number; counterpart: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
const make = (createApp: Factory, day = '2026-10-21'): { app: App; setDay: (d: string) => void } => {
  let today = day;
  const app = createApp({ today: () => today }) as App;
  return { app, setDay: (d) => { today = d; } };
};
const twoAccounts = (app: App): [string, string] => {
  const a = app.openAccount('Ana', 'EUR');
  const b = app.openAccount('Ana', 'EUR');
  app.deposit(a, 1500);
  return [a, b];
};

export const cases: TestCase[] = [
  {
    name: 'deposit and withdraw change the balance',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openAccount('Ana', 'EUR');
      app.deposit(a, 100);
      app.withdraw(a, 30.5);
      assert.equal(app.balanceOf(a), 69.5);
    },
  },
  {
    name: 'a withdrawal below zero is refused and says by how much',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openAccount('Ana', 'EUR');
      app.deposit(a, 10);
      assert.throws(() => app.withdraw(a, 25), /insufficient funds: short by EUR 15\.00/);
      assert.equal(app.balanceOf(a), 10);
    },
  },
  {
    name: 'opening an account sends a welcome notice',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openAccount('Ana', 'EUR');
      assert.ok(app.notices().some((n) => n.includes(a) && n.includes('Welcome')));
    },
  },
  {
    name: 'a transfer moves the money between two accounts',
    kind: 'feature',
    step: 'transfers',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoAccounts(app);
      app.transfer(a, b, 400);
      assert.equal(app.balanceOf(a), 1100);
      assert.equal(app.balanceOf(b), 400);
    },
  },
  {
    name: 'a transfer that would overdraw is refused and nothing changes',
    kind: 'feature',
    step: 'transfers',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openAccount('Ana', 'EUR');
      const b = app.openAccount('Ana', 'EUR');
      app.deposit(a, 50);
      assert.throws(() => app.transfer(a, b, 80), /insufficient funds/);
      assert.equal(app.balanceOf(a), 50);
      assert.equal(app.balanceOf(b), 0);
    },
  },
  {
    name: 'a transfer between currencies or to an unknown account is refused',
    kind: 'feature',
    step: 'transfers',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoAccounts(app);
      const usd = app.openAccount('Ana', 'USD');
      assert.equal(typeof app.transfer, 'function');
      assert.throws(() => app.transfer(a, usd, 10));
      assert.throws(() => app.transfer(a, 'A-9999', 10));
      assert.equal(app.balanceOf(a), 1500);
      assert.equal(app.balanceOf(usd), 0);
    },
  },
  {
    name: 'transfers over the daily limit are refused with what is left today',
    kind: 'feature',
    step: 'daily-limit',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoAccounts(app);
      app.transfer(a, b, 600);
      app.transfer(a, b, 200);
      assert.throws(() => app.transfer(a, b, 300), /200\.00 left today/);
      app.transfer(a, b, 200);
      assert.throws(() => app.transfer(a, b, 0.01), /0\.00 left today/);
      assert.equal(app.balanceOf(a), 500);
      assert.equal(app.balanceOf(b), 1000);
    },
  },
  {
    name: 'the daily limit starts again the next day and withdrawals do not count',
    kind: 'feature',
    step: 'daily-limit',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const [a, b] = twoAccounts(app);
      app.withdraw(a, 100);
      app.transfer(a, b, 1000);
      setDay('2026-10-22');
      app.transfer(a, b, 300);
      assert.equal(app.balanceOf(a), 100);
      assert.equal(app.balanceOf(b), 1300);
    },
  },
  {
    name: 'the statement lists movements newest first with the other account',
    kind: 'feature',
    step: 'statements',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoAccounts(app);
      app.withdraw(a, 100);
      app.transfer(a, b, 250);
      assert.deepEqual(app.statement(a), [
        { kind: 'transfer-out', amount: 250, counterpart: b },
        { kind: 'withdrawal', amount: 100, counterpart: null },
        { kind: 'deposit', amount: 1500, counterpart: null },
      ]);
      assert.deepEqual(app.statement(b), [{ kind: 'transfer-in', amount: 250, counterpart: a }]);
    },
  },
];
