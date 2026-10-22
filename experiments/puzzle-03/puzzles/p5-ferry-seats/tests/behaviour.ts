/**
 * P5 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface SailingView { id: string; route: string; departsAt: string; capacity: number; seatsLeft: number }
interface BookingView { id: string; passenger: string; sailingId: string; seats: number; status: string }
interface App {
  scheduleSailing(route: string, departsAt: string, capacity: number): string;
  sailing(id: string): SailingView | undefined;
  blockSeats(sailingId: string, party: string, seats: number): void;
  releaseBlock(sailingId: string, party: string): void;
  book(passenger: string, sailingId: string, seats: number): string;
  booking(id: string): BookingView | undefined;
  deskNotices(): string[];
  cancelBooking(id: string): void;
  cancelSailing(id: string): void;
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const DEPARTS = '2026-11-02T08:00:00Z';
const left = (a: App, s: string): number => a.sailing(s)?.seatsLeft ?? Number.NaN;
const status = (a: App, b: string): string => a.booking(b)?.status ?? 'missing';

export const cases: TestCase[] = [
  {
    name: 'a scheduled sailing shows its route and seats',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 40);
      const v = a.sailing(s);
      assert.deepEqual([v?.id, v?.route, v?.departsAt, v?.capacity, v?.seatsLeft], [s, 'Dover-Calais', DEPARTS, 40, 40]);
      assert.equal(a.sailing('S-9999'), undefined);
    },
  },
  {
    name: 'the group desk blocks and releases seats for a party',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 40);
      a.blockSeats(s, 'Coach 7', 10);
      assert.equal(left(a, s), 30);
      assert.throws(() => a.blockSeats(s, 'Coach 8', 31), /not enough seats: 30 left/);
      a.releaseBlock(s, 'Coach 7');
      assert.equal(left(a, s), 40);
    },
  },
  {
    name: 'a booking is recorded and the desk is told',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 40);
      const b = a.book('Ana', s, 2);
      const v = a.booking(b);
      assert.deepEqual([v?.passenger, v?.sailingId, v?.seats], ['Ana', s, 2]);
      assert.ok(a.deskNotices().some((n) => n.includes(`Booking ${b}`) && n.includes('Ana')));
    },
  },
  {
    name: 'a booking for an unknown sailing or a bad number of seats is refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 40);
      assert.throws(() => a.book('Ana', 'S-9999', 1), /no sailing/);
      assert.throws(() => a.book('Ana', s, 0), /1 to 9 seats/);
      assert.throws(() => a.book('Ana', s, 10), /1 to 9 seats/);
      assert.equal(left(a, s), 40);
    },
  },
  {
    name: 'a booking with enough seats left is confirmed and takes its seats',
    kind: 'feature',
    step: 'hold-seats',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      const b = a.book('Ana', s, 3);
      assert.equal(status(a, b), 'confirmed');
      assert.equal(left(a, s), 2);
    },
  },
  {
    name: 'a booking without enough seats is rejected and takes nothing',
    kind: 'feature',
    step: 'hold-seats',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      a.blockSeats(s, 'Coach 7', 3);
      const b = a.book('Ben', s, 3);
      assert.equal(status(a, b), 'rejected');
      assert.equal(left(a, s), 2);
      assert.equal(status(a, a.book('Cy', s, 2)), 'confirmed');
      assert.equal(left(a, s), 0);
    },
  },
  {
    name: 'a sailing never gives out more seats than it has',
    kind: 'feature',
    step: 'hold-seats',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      const ids = ['Ana', 'Ben', 'Cy', 'Di'].map((p) => a.book(p, s, 2));
      assert.deepEqual(ids.map((b) => status(a, b)), ['confirmed', 'confirmed', 'rejected', 'rejected']);
      assert.equal(left(a, s), 1);
      assert.throws(() => a.blockSeats(s, 'Coach 7', 2), /not enough seats: 1 left/);
    },
  },
  {
    name: 'a cancelled booking frees its seats at once',
    kind: 'feature',
    step: 'cancel-booking',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      const b = a.book('Ana', s, 3);
      a.cancelBooking(b);
      assert.equal(status(a, b), 'cancelled');
      assert.equal(left(a, s), 5);
      assert.equal(status(a, a.book('Ben', s, 5)), 'confirmed');
    },
  },
  {
    name: 'cancelling twice, or cancelling a rejected booking, changes nothing',
    kind: 'feature',
    step: 'cancel-booking',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      const b1 = a.book('Ana', s, 3);
      const b2 = a.book('Ben', s, 3);
      a.cancelBooking(b1);
      const b3 = a.book('Cy', s, 4);
      a.cancelBooking(b1);
      a.cancelBooking(b2);
      assert.deepEqual([status(a, b1), status(a, b2), status(a, b3)], ['cancelled', 'rejected', 'confirmed']);
      assert.equal(left(a, s), 1);
    },
  },
  {
    name: 'bookings on a cancelled sailing show it, and new bookings on it are rejected',
    kind: 'feature',
    step: 'sailing-cancelled',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.scheduleSailing('Dover-Calais', DEPARTS, 5);
      const other = a.scheduleSailing('Dover-Calais', '2026-11-02T12:00:00Z', 5);
      const b1 = a.book('Ana', s, 2);
      const b2 = a.book('Ben', s, 2);
      a.cancelBooking(b2);
      const b3 = a.book('Cy', other, 2);
      a.cancelSailing(s);
      assert.deepEqual([status(a, b1), status(a, b2), status(a, b3)], ['sailing-cancelled', 'cancelled', 'confirmed']);
      assert.equal(status(a, a.book('Di', s, 1)), 'rejected');
      assert.equal(status(a, a.book('Ed', other, 1)), 'confirmed');
    },
  },
];
