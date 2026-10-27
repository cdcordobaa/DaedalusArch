/**
 * F5 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; feature cases fail on the seed. Every refusal is checked in the one form the request names: the existing
 * refusals (unknown car park, bad number of bays, unknown reservation or car park in the new calls) throw; a
 * reservation refused for want of bays, or because the car park is closed, is returned with status 'rejected' and
 * never throws.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface CarParkView { id: string; name: string; bays: number; baysFree: number }
interface ReservationView { id: string; driver: string; carParkId: string; bays: number; status: string }
interface App {
  openCarPark(name: string, bays: number): string;
  carPark(id: string): CarParkView | undefined;
  blockBays(carParkId: string, company: string, bays: number): void;
  releaseBlock(carParkId: string, company: string): void;
  reserve(driver: string, carParkId: string, bays: number): string;
  reservation(id: string): ReservationView | undefined;
  attendantNotices(): string[];
  cancelReservation(id: string): void;
  closeCarPark(id: string): void;
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const free = (a: App, p: string): number => a.carPark(p)?.baysFree ?? Number.NaN;
const status = (a: App, r: string): string => a.reservation(r)?.status ?? 'missing';

export const cases: TestCase[] = [
  {
    name: 'an opened car park shows its name and bays',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 40);
      const v = a.carPark(p);
      assert.deepEqual([v?.id, v?.name, v?.bays, v?.baysFree], [p, 'Station Road', 40, 40]);
      assert.equal(a.carPark('P-9999'), undefined);
    },
  },
  {
    name: 'the contracts desk blocks and releases bays for a company',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 40);
      a.blockBays(p, 'Acme Ltd', 10);
      assert.equal(free(a, p), 30);
      assert.throws(() => a.blockBays(p, 'Bolt plc', 31), /not enough bays: 30 free/);
      a.releaseBlock(p, 'Acme Ltd');
      assert.equal(free(a, p), 40);
    },
  },
  {
    name: 'a reservation is recorded and the attendants are told',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 40);
      const r = a.reserve('Ana', p, 2);
      const v = a.reservation(r);
      assert.deepEqual([v?.driver, v?.carParkId, v?.bays], ['Ana', p, 2]);
      assert.ok(a.attendantNotices().some((n) => n.includes(`Reservation ${r}`) && n.includes('Ana')));
    },
  },
  {
    name: 'a reservation for an unknown car park or a bad number of bays throws',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 40);
      assert.throws(() => a.reserve('Ana', 'P-9999', 1), /no car park/);
      assert.throws(() => a.reserve('Ana', p, 0), /1 to 6 bays/);
      assert.throws(() => a.reserve('Ana', p, 7), /1 to 6 bays/);
      assert.equal(free(a, p), 40);
    },
  },
  {
    name: 'a reservation with enough bays free is confirmed and takes its bays',
    kind: 'feature',
    step: 'hold-bays',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      const r = a.reserve('Ana', p, 3);
      assert.equal(status(a, r), 'confirmed');
      assert.equal(free(a, p), 2);
    },
  },
  {
    name: 'a reservation without enough bays is returned rejected, does not throw, and takes nothing',
    kind: 'feature',
    step: 'hold-bays',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      a.blockBays(p, 'Acme Ltd', 3);
      let r = '';
      assert.doesNotThrow(() => { r = a.reserve('Ben', p, 3); });
      assert.equal(status(a, r), 'rejected');
      assert.equal(free(a, p), 2);
      assert.equal(status(a, a.reserve('Cy', p, 2)), 'confirmed');
      assert.equal(free(a, p), 0);
    },
  },
  {
    name: 'a car park never gives out more bays than it has',
    kind: 'feature',
    step: 'hold-bays',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      const ids = ['Ana', 'Ben', 'Cy', 'Di'].map((d) => a.reserve(d, p, 2));
      assert.deepEqual(ids.map((r) => status(a, r)), ['confirmed', 'confirmed', 'rejected', 'rejected']);
      assert.equal(free(a, p), 1);
      assert.throws(() => a.blockBays(p, 'Acme Ltd', 2), /not enough bays: 1 free/);
    },
  },
  {
    name: 'a cancelled reservation frees its bays at once',
    kind: 'feature',
    step: 'cancel-reservation',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      const r = a.reserve('Ana', p, 3);
      a.cancelReservation(r);
      assert.equal(status(a, r), 'cancelled');
      assert.equal(free(a, p), 5);
      assert.equal(status(a, a.reserve('Ben', p, 5)), 'confirmed');
    },
  },
  {
    name: 'cancelling twice, or cancelling a rejected reservation, returns normally and changes nothing; an unknown one throws',
    kind: 'feature',
    step: 'cancel-reservation',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      const r1 = a.reserve('Ana', p, 3);
      const r2 = a.reserve('Ben', p, 3);
      a.cancelReservation(r1);
      const r3 = a.reserve('Cy', p, 4);
      assert.doesNotThrow(() => a.cancelReservation(r1));
      assert.doesNotThrow(() => a.cancelReservation(r2));
      assert.deepEqual([status(a, r1), status(a, r2), status(a, r3)], ['cancelled', 'rejected', 'confirmed']);
      assert.equal(free(a, p), 1);
      assert.throws(() => a.cancelReservation('R-9999'), /no reservation R-9999/);
      assert.equal(free(a, p), 1);
    },
  },
  {
    name: 'reservations in a closed car park show it, and new reservations there are returned rejected',
    kind: 'feature',
    step: 'car-park-closed',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.openCarPark('Station Road', 5);
      const other = a.openCarPark('Market Square', 5);
      const r1 = a.reserve('Ana', p, 2);
      const r2 = a.reserve('Ben', p, 2);
      a.cancelReservation(r2);
      const r3 = a.reserve('Cy', other, 2);
      a.closeCarPark(p);
      assert.deepEqual([status(a, r1), status(a, r2), status(a, r3)], ['car-park-closed', 'cancelled', 'confirmed']);
      const before = free(a, p);
      let r4 = '';
      assert.doesNotThrow(() => { r4 = a.reserve('Di', p, 1); });
      assert.equal(status(a, r4), 'rejected');
      assert.equal(free(a, p), before);
      assert.equal(status(a, a.reserve('Ed', other, 1)), 'confirmed');
      assert.throws(() => a.closeCarPark('P-9999'), /no car park P-9999/);
    },
  },
];
