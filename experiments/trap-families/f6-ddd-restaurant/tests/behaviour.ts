/**
 * F6 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed. Every refusal the tests check is stated in the seed code (party size,
 * unknown guest, unknown reservation, completing twice) or in the step text (a refused completion adds no visit).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface App {
  registerGuest(name: string): string;
  addVisits(guestId: string, visits: number): void;
  guestProfile(guestId: string): { guestId: string; name: string; visits: number; status: string } | undefined;
  book(guestId: string | null, partySize: number): { reservationId: string; deposit: number; waived?: number };
  complete(reservationId: string): void;
  messages(): string[];
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const guestWith = (a: App, visits: number): string => {
  const id = a.registerGuest('Bea');
  if (visits > 0) a.addVisits(id, visits);
  return id;
};
/** A table for four: 4 x 12.50 = 50.00 deposit before any waiver. */
const FOUR = 4;

export const cases: TestCase[] = [
  {
    name: 'a guest profile shows visits and status',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const g = guestWith(a, 6);
      assert.deepEqual(a.guestProfile(g), { guestId: g, name: 'Bea', visits: 6, status: 'regular' });
      assert.equal(a.guestProfile(guestWith(a, 0))?.status, 'new');
      assert.equal(a.guestProfile(guestWith(a, 20))?.status, 'vip');
    },
  },
  {
    name: 'a table is booked with a confirmation, and completing it sends a thank-you',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const r = a.book(null, 2);
      assert.equal(r.deposit, 25);
      assert.ok(a.messages().some((t) => t.includes(r.reservationId) && t.includes('25.00')));
      a.complete(r.reservationId);
      assert.ok(a.messages().some((t) => t.startsWith('Thank you') && t.includes(r.reservationId)));
    },
  },
  {
    name: 'a bad party size, an unknown guest, an unknown reservation and a second completion are refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      assert.throws(() => a.book(null, 0), /party size/);
      assert.throws(() => a.book(null, 9), /party size/);
      assert.throws(() => a.book('G-9999', 2), /no guest/);
      assert.throws(() => a.complete('R-9999'), /no reservation/);
      const r = a.book(null, 2);
      a.complete(r.reservationId);
      assert.throws(() => a.complete(r.reservationId), /already completed/);
    },
  },
  {
    name: 'VIP guests pay no deposit and regulars half, with the waived amount shown',
    kind: 'feature',
    step: 'status-waiver',
    run: (createApp) => {
      const a = app(createApp);
      const vip = a.book(guestWith(a, 20), FOUR);
      assert.deepEqual([vip.deposit, vip.waived], [0, 50]);
      const regular = a.book(guestWith(a, 6), FOUR);
      assert.deepEqual([regular.deposit, regular.waived], [25, 25]);
    },
  },
  {
    name: 'new guests and bookings without a profile pay the full deposit',
    kind: 'feature',
    step: 'status-waiver',
    run: (createApp) => {
      const a = app(createApp);
      const fresh = a.book(guestWith(a, 1), FOUR);
      assert.deepEqual([fresh.deposit, fresh.waived], [50, 0]);
      const anonymous = a.book(null, FOUR);
      assert.deepEqual([anonymous.deposit, anonymous.waived], [50, 0]);
    },
  },
  {
    name: 'VIP starts at 10 visits, on the profile and in the deposit',
    kind: 'feature',
    step: 'vip-threshold',
    run: (createApp) => {
      const a = app(createApp);
      const g = guestWith(a, 10);
      assert.equal(a.guestProfile(g)?.status, 'vip');
      assert.equal(a.book(g, FOUR).waived, 50);
      const r = guestWith(a, 9);
      assert.equal(a.guestProfile(r)?.status, 'regular');
      assert.equal(a.book(r, FOUR).waived, 25);
    },
  },
  {
    name: 'every completed reservation is one visit on the guest profile',
    kind: 'feature',
    step: 'visits-on-completion',
    run: (createApp) => {
      const a = app(createApp);
      const g = guestWith(a, 0);
      const first = a.book(g, 2);
      assert.equal(a.guestProfile(g)?.visits, 0);
      a.complete(first.reservationId);
      assert.equal(a.guestProfile(g)?.visits, 1);
      a.complete(a.book(g, 3).reservationId);
      assert.equal(a.guestProfile(g)?.visits, 2);
      const v = guestWith(a, 12);
      a.complete(a.book(v, FOUR).reservationId);
      assert.equal(a.guestProfile(v)?.visits, 13);
    },
  },
  {
    name: 'a completed visit counts for the next booking; refused completions and bookings without a profile count for no one',
    kind: 'feature',
    step: 'visits-on-completion',
    run: (createApp) => {
      const a = app(createApp);
      const g = guestWith(a, 3);
      const r = a.book(g, FOUR);
      assert.equal(r.waived, 0);
      a.complete(r.reservationId);
      assert.equal(a.guestProfile(g)?.status, 'regular');
      assert.equal(a.book(g, FOUR).waived, 25);
      assert.throws(() => a.complete(r.reservationId), /already completed/);
      assert.equal(a.guestProfile(g)?.visits, 4);
      assert.doesNotThrow(() => a.complete(a.book(null, FOUR).reservationId));
    },
  },
];
