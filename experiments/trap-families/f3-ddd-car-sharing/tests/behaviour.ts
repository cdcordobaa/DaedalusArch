/**
 * F3 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface BookingLine { bookingId: string; memberId: string; start: string; end: string }
interface App {
  addCar(plate: string, zone: string): string;
  book(carId: string, memberId: string, start: string, end: string): string;
  cancel(carId: string, bookingId: string): void;
  bookingsOf(carId: string): BookingLine[];
  notices(): string[];
  moveBooking(bookingId: string, fromCarId: string, toCarId: string): unknown;
  logOf(carId: string): { kind: string; bookingId: string; otherCar: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
const make = (createApp: Factory, day = '2026-10-21'): { app: App; setDay: (d: string) => void } => {
  let today = day;
  const app = createApp({ today: () => today }) as App;
  return { app, setDay: (d) => { today = d; } };
};
const D = '2026-10-21';
/** Two cars in the same zone. */
const twoCars = (app: App): [string, string] => [app.addCar('AB-101', 'north'), app.addCar('AB-102', 'north')];
const ids = (lines: BookingLine[]): string[] => lines.map((l) => l.bookingId);

export const cases: TestCase[] = [
  {
    name: 'booking and cancelling change the car calendar',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoCars(app);
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      const b2 = app.book(a, 'm-2', `${D}T07:00`, `${D}T08:00`);
      assert.deepEqual(app.bookingsOf(a), [
        { bookingId: b2, memberId: 'm-2', start: `${D}T07:00`, end: `${D}T08:00` },
        { bookingId: b1, memberId: 'm-1', start: `${D}T09:00`, end: `${D}T11:00` },
      ]);
      app.cancel(a, b2);
      assert.deepEqual(ids(app.bookingsOf(a)), [b1]);
      assert.throws(() => app.cancel(a, b2), /is not on/);
    },
  },
  {
    name: 'an overlapping booking is refused and names the booking in the way',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoCars(app);
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      assert.throws(() => app.book(a, 'm-2', `${D}T10:30`, `${D}T12:00`), new RegExp(`car not free: ${a} has ${b1}`));
      assert.deepEqual(ids(app.bookingsOf(a)), [b1]);
    },
  },
  {
    name: 'direct bookings may follow each other with no gap',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoCars(app);
      app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      app.book(a, 'm-2', `${D}T11:00`, `${D}T12:00`);
      app.book(a, 'm-3', `${D}T08:00`, `${D}T09:00`);
      assert.equal(app.bookingsOf(a).length, 3);
    },
  },
  {
    name: 'adding a car sends an availability notice',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.addCar('AB-101', 'north');
      assert.ok(app.notices().some((n) => n.includes(a) && n.includes('AB-101') && n.includes('north')));
    },
  },
  {
    name: 'a move takes the booking off one car and puts it on the other unchanged',
    kind: 'feature',
    step: 'moves',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      const b2 = app.book(a, 'm-2', `${D}T13:00`, `${D}T14:00`);
      app.book(b, 'm-3', `${D}T16:00`, `${D}T17:00`);
      app.moveBooking(b1, a, b);
      assert.deepEqual(ids(app.bookingsOf(a)), [b2]);
      assert.deepEqual(app.bookingsOf(b)[0], { bookingId: b1, memberId: 'm-1', start: `${D}T09:00`, end: `${D}T11:00` });
      assert.equal(app.bookingsOf(b).length, 2);
    },
  },
  {
    name: 'a move onto a car booked at an overlapping time is refused and nothing changes',
    kind: 'feature',
    step: 'moves',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      const b2 = app.book(b, 'm-2', `${D}T10:00`, `${D}T10:30`);
      assert.throws(() => app.moveBooking(b1, a, b), new RegExp(`car not free: ${b} has ${b2}`));
      assert.deepEqual(ids(app.bookingsOf(a)), [b1]);
      assert.deepEqual(ids(app.bookingsOf(b)), [b2]);
    },
  },
  {
    name: 'a move across zones, to an unknown car or of a booking the car does not hold is refused',
    kind: 'feature',
    step: 'moves',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const south = app.addCar('CD-201', 'south');
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T11:00`);
      assert.equal(typeof app.moveBooking, 'function');
      assert.throws(() => app.moveBooking(b1, a, south));
      assert.throws(() => app.moveBooking(b1, a, 'C-9999'));
      assert.throws(() => app.moveBooking(b1, b, a));
      assert.throws(() => app.moveBooking('B-9999', a, b));
      assert.throws(() => app.moveBooking(b1, a, a));
      assert.deepEqual(ids(app.bookingsOf(a)), [b1]);
      assert.deepEqual(app.bookingsOf(b), []);
      assert.deepEqual(app.bookingsOf(south), []);
    },
  },
  {
    name: 'a moved booking needs a cleaning gap before and after and the refusal names the clash',
    kind: 'feature',
    step: 'cleaning-gap',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const early = app.book(b, 'm-2', `${D}T07:00`, `${D}T08:45`);
      const m1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T10:00`);
      assert.throws(() => app.moveBooking(m1, a, b), new RegExp(`no cleaning gap: ${b} has ${early}`));
      app.cancel(b, early);
      const late = app.book(b, 'm-3', `${D}T10:10`, `${D}T12:00`);
      assert.throws(() => app.moveBooking(m1, a, b), new RegExp(`no cleaning gap: ${b} has ${late}`));
      assert.deepEqual(ids(app.bookingsOf(a)), [m1]);
      assert.deepEqual(ids(app.bookingsOf(b)), [late]);
    },
  },
  {
    name: 'a gap of exactly 30 minutes is enough and direct bookings keep needing none',
    kind: 'feature',
    step: 'cleaning-gap',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const before = app.book(b, 'm-2', `${D}T07:00`, `${D}T08:30`);
      const after = app.book(b, 'm-3', `${D}T10:30`, `${D}T12:00`);
      const m1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T10:00`);
      app.moveBooking(m1, a, b);
      assert.deepEqual(ids(app.bookingsOf(b)), [before, m1, after]);
      const direct = app.book(b, 'm-4', `${D}T12:00`, `${D}T13:00`);
      const m5 = app.book(a, 'm-5', `${D}T14:00`, `${D}T15:00`);
      app.book(a, 'm-6', `${D}T13:00`, `${D}T14:00`);
      app.moveBooking(m5, a, b);
      assert.deepEqual(ids(app.bookingsOf(b)), [before, m1, after, direct, m5]);
    },
  },
  {
    name: 'the car log lists calendar changes newest first with the other car',
    kind: 'feature',
    step: 'car-log',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoCars(app);
      const b1 = app.book(a, 'm-1', `${D}T09:00`, `${D}T10:00`);
      const b2 = app.book(a, 'm-2', `${D}T12:00`, `${D}T13:00`);
      app.cancel(a, b2);
      app.moveBooking(b1, a, b);
      assert.deepEqual(app.logOf(a), [
        { kind: 'moved-out', bookingId: b1, otherCar: b },
        { kind: 'cancelled', bookingId: b2, otherCar: null },
        { kind: 'booked', bookingId: b2, otherCar: null },
        { kind: 'booked', bookingId: b1, otherCar: null },
      ]);
      assert.deepEqual(app.logOf(b), [{ kind: 'moved-in', bookingId: b1, otherCar: a }]);
    },
  },
];
