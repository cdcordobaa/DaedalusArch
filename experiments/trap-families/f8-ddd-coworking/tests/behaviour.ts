/**
 * F8 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface ReservationLine { reservationId: string; teamId: string; people: number; start: string; end: string }
interface App {
  openRoom(name: string, site: string, seats: number): string;
  reserve(roomId: string, teamId: string, people: number, start: string, end: string): string;
  cancel(roomId: string, reservationId: string): void;
  reservationsOf(roomId: string): ReservationLine[];
  notices(): string[];
  relocate(reservationId: string, fromRoomId: string, toRoomId: string): unknown;
  historyOf(roomId: string): { kind: string; reservationId: string; otherRoom: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
const make = (createApp: Factory, day = '2026-10-21'): { app: App; setDay: (d: string) => void } => {
  let today = day;
  const app = createApp({ today: () => today }) as App;
  return { app, setDay: (d) => { today = d; } };
};
const D = '2026-10-21';
const D2 = '2026-10-22';
/** Two six-seat rooms at the same site. */
const twoRooms = (app: App): [string, string] => [app.openRoom('Atlas', 'harbour', 6), app.openRoom('Borealis', 'harbour', 6)];
const ids = (lines: ReservationLine[]): string[] => lines.map((l) => l.reservationId);

export const cases: TestCase[] = [
  {
    name: 'reserving and cancelling change the room calendar',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoRooms(app);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T09:00`, `${D}T11:00`);
      const r2 = app.reserve(a, 'team-red', 2, `${D}T07:00`, `${D}T08:00`);
      assert.deepEqual(app.reservationsOf(a), [
        { reservationId: r2, teamId: 'team-red', people: 2, start: `${D}T07:00`, end: `${D}T08:00` },
        { reservationId: r1, teamId: 'team-blue', people: 4, start: `${D}T09:00`, end: `${D}T11:00` },
      ]);
      app.cancel(a, r2);
      assert.deepEqual(ids(app.reservationsOf(a)), [r1]);
      assert.throws(() => app.cancel(a, r2), /is not in/);
    },
  },
  {
    name: 'an overlapping reservation is refused and names the reservation in the way',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a] = twoRooms(app);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T09:00`, `${D}T11:00`);
      assert.throws(() => app.reserve(a, 'team-red', 2, `${D}T10:30`, `${D}T12:00`), new RegExp(`room not free: ${a} has ${r1}`));
      assert.deepEqual(ids(app.reservationsOf(a)), [r1]);
    },
  },
  {
    name: 'a reservation for more people than the room seats is refused',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const small = app.openRoom('Nook', 'harbour', 4);
      assert.throws(() => app.reserve(small, 'team-blue', 6, `${D}T09:00`, `${D}T10:00`), new RegExp(`room too small: ${small} seats 4`));
      app.reserve(small, 'team-blue', 4, `${D}T09:00`, `${D}T10:00`);
      assert.equal(app.reservationsOf(small).length, 1);
    },
  },
  {
    name: 'opening a room sends a listing notice',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openRoom('Atlas', 'harbour', 6);
      assert.ok(app.notices().some((n) => n.includes(a) && n.includes('Atlas') && n.includes('harbour')));
    },
  },
  {
    name: 'a relocation takes the reservation out of one room and puts it in the other unchanged',
    kind: 'feature',
    step: 'relocations',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      const r1 = app.reserve(a, 'team-blue', 5, `${D}T09:00`, `${D}T11:00`);
      const r2 = app.reserve(a, 'team-red', 2, `${D}T13:00`, `${D}T14:00`);
      app.reserve(b, 'team-green', 3, `${D}T16:00`, `${D}T17:00`);
      app.relocate(r1, a, b);
      assert.deepEqual(ids(app.reservationsOf(a)), [r2]);
      assert.deepEqual(app.reservationsOf(b)[0], { reservationId: r1, teamId: 'team-blue', people: 5, start: `${D}T09:00`, end: `${D}T11:00` });
      assert.equal(app.reservationsOf(b).length, 2);
    },
  },
  {
    name: 'a relocation into a room that is taken or too small is refused and nothing changes',
    kind: 'feature',
    step: 'relocations',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      const small = app.openRoom('Nook', 'harbour', 4);
      const r1 = app.reserve(a, 'team-blue', 5, `${D}T09:00`, `${D}T11:00`);
      const r2 = app.reserve(b, 'team-red', 2, `${D}T10:00`, `${D}T10:30`);
      assert.throws(() => app.relocate(r1, a, b), new RegExp(`room not free: ${b} has ${r2}`));
      assert.throws(() => app.relocate(r1, a, small), new RegExp(`room too small: ${small} seats 4`));
      assert.deepEqual(ids(app.reservationsOf(a)), [r1]);
      assert.deepEqual(ids(app.reservationsOf(b)), [r2]);
      assert.deepEqual(app.reservationsOf(small), []);
    },
  },
  {
    name: 'a relocation across sites, to an unknown room or of a reservation the room does not hold is refused',
    kind: 'feature',
    step: 'relocations',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      const other = app.openRoom('Cedar', 'old-town', 8);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T09:00`, `${D}T11:00`);
      assert.equal(typeof app.relocate, 'function');
      assert.throws(() => app.relocate(r1, a, other));
      assert.throws(() => app.relocate(r1, a, 'R-9999'));
      assert.throws(() => app.relocate(r1, b, a));
      assert.throws(() => app.relocate('S-9999', a, b));
      assert.throws(() => app.relocate(r1, a, a));
      assert.deepEqual(ids(app.reservationsOf(a)), [r1]);
      assert.deepEqual(app.reservationsOf(b), []);
      assert.deepEqual(app.reservationsOf(other), []);
    },
  },
  {
    name: 'a relocation over the team cap is refused with the hours left',
    kind: 'feature',
    step: 'team-cap',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      app.reserve(b, 'team-blue', 4, `${D}T08:00`, `${D}T10:00`);
      app.reserve(b, 'team-red', 4, `${D}T10:00`, `${D}T13:00`);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T13:00`, `${D}T16:00`);
      assert.throws(() => app.relocate(r1, a, b), new RegExp(`team cap reached: team-blue has 2\\.00 h left in ${b} on ${D}`));
      app.reserve(b, 'team-blue', 4, `${D}T17:00`, `${D}T19:30`);
      const r2 = app.reserve(a, 'team-blue', 4, `${D}T20:00`, `${D}T20:30`);
      assert.throws(() => app.relocate(r2, a, b), new RegExp(`team cap reached: team-blue has 0\\.00 h left in ${b} on ${D}`));
      assert.deepEqual(ids(app.reservationsOf(a)), [r1, r2]);
      assert.equal(app.reservationsOf(b).length, 3);
    },
  },
  {
    name: 'exactly four hours is allowed, other teams and other days do not count, direct reservations are not capped',
    kind: 'feature',
    step: 'team-cap',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      app.reserve(b, 'team-blue', 4, `${D}T08:00`, `${D}T10:30`);
      app.reserve(b, 'team-red', 4, `${D}T10:30`, `${D}T16:00`);
      app.reserve(b, 'team-blue', 4, `${D2}T08:00`, `${D2}T13:00`);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T16:00`, `${D}T17:30`);
      app.relocate(r1, a, b);
      assert.deepEqual(ids(app.reservationsOf(a)), []);
      app.reserve(b, 'team-blue', 4, `${D}T18:00`, `${D}T21:00`);
      assert.equal(app.reservationsOf(b).length, 5);
    },
  },
  {
    name: 'the room history lists calendar changes newest first with the other room',
    kind: 'feature',
    step: 'room-history',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoRooms(app);
      const r1 = app.reserve(a, 'team-blue', 4, `${D}T09:00`, `${D}T10:00`);
      const r2 = app.reserve(a, 'team-red', 2, `${D}T12:00`, `${D}T13:00`);
      app.cancel(a, r2);
      app.relocate(r1, a, b);
      assert.deepEqual(app.historyOf(a), [
        { kind: 'relocated-out', reservationId: r1, otherRoom: b },
        { kind: 'cancelled', reservationId: r2, otherRoom: null },
        { kind: 'reserved', reservationId: r2, otherRoom: null },
        { kind: 'reserved', reservationId: r1, otherRoom: null },
      ]);
      assert.deepEqual(app.historyOf(b), [{ kind: 'relocated-in', reservationId: r1, otherRoom: a }]);
    },
  },
];
