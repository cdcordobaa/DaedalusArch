/**
 * F4 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface App {
  join(name: string): string;
  addVisits(memberId: string, visits: number): void;
  memberCard(memberId: string): { memberId: string; name: string; visits: number; level: string } | undefined;
  bookClass(memberId: string | null, classes: { classCode: string; sessions: number; fee: number }[]): { bookingId: string; total: number; discount?: number };
  confirmations(): string[];
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const memberWith = (a: App, visits: number): string => {
  const id = a.join('Bea');
  if (visits > 0) a.addVisits(id, visits);
  return id;
};
/** Four yoga sessions at 25.00: 100.00 before any discount. */
const hundred = [{ classCode: 'YOGA', sessions: 4, fee: 25 }];

export const cases: TestCase[] = [
  {
    name: 'a member card shows visits and level',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 30);
      assert.deepEqual(a.memberCard(m), { memberId: m, name: 'Bea', visits: 30, level: 'plus' });
      assert.equal(a.memberCard(memberWith(a, 0))?.level, 'basic');
      assert.equal(a.memberCard(memberWith(a, 70))?.level, 'premium');
    },
  },
  {
    name: 'a class is booked and a confirmation is sent',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const r = a.bookClass(null, [{ classCode: 'SPIN', sessions: 2, fee: 3.5 }]);
      assert.equal(r.total, 7);
      assert.ok(a.confirmations().some((t) => t.includes(r.bookingId) && t.includes('7.00')));
    },
  },
  {
    name: 'a booking with a bad class or an unknown member is refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      assert.throws(() => a.bookClass(null, [{ classCode: 'SPIN', sessions: 0, fee: 3 }]), /sessions/);
      assert.throws(() => a.bookClass('G-9999', hundred), /no member/);
    },
  },
  {
    name: 'premium members get 20% off and plus members 10%, shown separately',
    kind: 'feature',
    step: 'level-discount',
    run: (createApp) => {
      const a = app(createApp);
      const premium = a.bookClass(memberWith(a, 70), hundred);
      assert.deepEqual([premium.total, premium.discount], [80, 20]);
      const plus = a.bookClass(memberWith(a, 30), hundred);
      assert.deepEqual([plus.total, plus.discount], [90, 10]);
    },
  },
  {
    name: 'basic members and drop-in guests pay the full price',
    kind: 'feature',
    step: 'level-discount',
    run: (createApp) => {
      const a = app(createApp);
      const basic = a.bookClass(memberWith(a, 5), hundred);
      assert.deepEqual([basic.total, basic.discount], [100, 0]);
      const guest = a.bookClass(null, hundred);
      assert.deepEqual([guest.total, guest.discount], [100, 0]);
    },
  },
  {
    name: 'premium starts at 45 visits, on the card and at booking',
    kind: 'feature',
    step: 'premium-threshold',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 45);
      assert.equal(a.memberCard(m)?.level, 'premium');
      assert.equal(a.bookClass(m, hundred).discount, 20);
      const p = memberWith(a, 44);
      assert.equal(a.memberCard(p)?.level, 'plus');
      assert.equal(a.bookClass(p, hundred).discount, 10);
    },
  },
  {
    name: 'every booked session is one visit on the member card',
    kind: 'feature',
    step: 'visits-on-bookings',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 0);
      a.bookClass(m, [{ classCode: 'YOGA', sessions: 2, fee: 12.5 }, { classCode: 'SPIN', sessions: 3, fee: 9 }]);
      assert.equal(a.memberCard(m)?.visits, 5);
      const g = memberWith(a, 45);
      a.bookClass(g, hundred);
      assert.equal(a.memberCard(g)?.visits, 49);
    },
  },
  {
    name: 'booked visits count for the next booking and guests get nothing',
    kind: 'feature',
    step: 'visits-on-bookings',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 23);
      assert.equal(a.bookClass(m, [{ classCode: 'YOGA', sessions: 2, fee: 25 }]).discount, 0);
      assert.equal(a.memberCard(m)?.level, 'plus');
      assert.equal(a.bookClass(m, hundred).discount, 10);
      assert.doesNotThrow(() => a.bookClass(null, hundred));
    },
  },
];
