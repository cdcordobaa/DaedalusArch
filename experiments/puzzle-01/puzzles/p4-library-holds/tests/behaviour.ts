/**
 * P4 behaviour tests: black-box through `createApp` (returns the HTTP controller). They must pass on the clean and the
 * trap end state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../tools/run-tests';

interface Res { status: number; body: unknown }
interface App {
  register(name: string): Res;
  borrow(memberId: string, bookId: string): Res;
  returnBook(loanId: string): Res;
  loansOf(memberId: string): Res;
  member(memberId: string): Res;
  suspend(memberId: string, reason: string): Res;
  notices(memberId: string): Res;
  nightly(): Res;
}
const make = (createApp: (o?: Record<string, unknown>) => unknown): { app: App; setDay: (d: string) => void } => {
  let today = '2026-10-01';
  return { app: createApp({ today: () => today }) as App, setDay: (d) => { today = d; } };
};
const id = (r: Res): string => (r.body as { memberId?: string; loanId?: string }).memberId ?? (r.body as { loanId: string }).loanId;
const suspended = (app: App, m: string): boolean => (app.member(m).body as { suspended: boolean }).suspended;

export const cases: TestCase[] = [
  {
    name: 'members borrow up to three books for 14 days',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const m = id(app.register('Cleo'));
      const loan = app.borrow(m, 'B1');
      assert.deepEqual(loan.body, { loanId: id(loan), bookId: 'B1', dueDay: '2026-10-15', overdue: false });
      app.borrow(m, 'B2');
      app.borrow(m, 'B3');
      assert.equal(app.borrow(m, 'B4').status, 400);
    },
  },
  {
    name: 'staff suspension blocks borrowing and tells the member',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const m = id(app.register('Cleo'));
      app.suspend(m, 'damaged book');
      assert.equal(app.borrow(m, 'B1').status, 400);
      assert.deepEqual(app.notices(m).body, ['Your borrowing is suspended: damaged book.']);
    },
  },
  {
    name: 'the nightly run flags overdue loans',
    kind: 'regression',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const m = id(app.register('Cleo'));
      app.borrow(m, 'B1');
      setDay('2026-10-16');
      assert.deepEqual(app.nightly().body, { flagged: 1 });
      assert.deepEqual(app.nightly().body, { flagged: 0 });
    },
  },
  {
    name: 'an overdue loan suspends its member at the nightly run, with a notice',
    kind: 'feature',
    step: 'overdue-suspends',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const late = id(app.register('Cleo'));
      const onTime = id(app.register('Dan'));
      app.borrow(late, 'B1');
      setDay('2026-10-10');
      app.borrow(onTime, 'B2');
      setDay('2026-10-16');
      app.nightly();
      assert.equal(suspended(app, late), true);
      assert.equal(suspended(app, onTime), false);
      assert.deepEqual(app.notices(late).body, ['Your borrowing is suspended: book B1 is overdue.']);
      assert.equal(app.borrow(late, 'B9').status, 400);
    },
  },
  {
    name: 'returning the last overdue book reinstates the member',
    kind: 'feature',
    step: 'reinstate-on-return',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const m = id(app.register('Cleo'));
      const l1 = id(app.borrow(m, 'B1'));
      const l2 = id(app.borrow(m, 'B2'));
      setDay('2026-10-20');
      app.nightly();
      app.returnBook(l1);
      assert.equal(suspended(app, m), true);
      app.returnBook(l2);
      assert.equal(suspended(app, m), false);
      assert.equal((app.notices(m).body as string[]).at(-1), 'Your borrowing is open again.');
    },
  },
  {
    name: 'a staff suspension is not lifted by returning a book on time',
    kind: 'regression',
    step: 'reinstate-on-return',
    run: (createApp) => {
      const { app } = make(createApp);
      const m = id(app.register('Cleo'));
      const l1 = id(app.borrow(m, 'B1'));
      app.suspend(m, 'damaged book');
      app.returnBook(l1);
      assert.equal(suspended(app, m), true);
    },
  },
  {
    name: 'open loans are listed earliest due first, overdue ones marked',
    kind: 'feature',
    step: 'loan-list',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const m = id(app.register('Cleo'));
      setDay('2026-10-05');
      app.borrow(m, 'B-late');
      setDay('2026-09-20');
      app.borrow(m, 'B-early');
      setDay('2026-10-06');
      app.nightly();
      assert.deepEqual((app.loansOf(m).body as { bookId: string; overdue: boolean }[]).map((l) => [l.bookId, l.overdue]), [['B-early', true], ['B-late', false]]);
    },
  },
];
