/**
 * F7 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; feature cases fail on the seed. Every refusal is checked in the one form the request names: the existing
 * refusals (unknown shift, bad number of places, unknown sign-up or shift in the new calls) throw; a sign-up refused
 * for want of places, or because the shift is cancelled, is returned with status 'rejected' and never throws.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface ShiftView { id: string; name: string; places: number; placesFree: number }
interface SignUpView { id: string; volunteer: string; shiftId: string; places: number; status: string }
interface App {
  openShift(name: string, places: number): string;
  shift(id: string): ShiftView | undefined;
  blockPlaces(shiftId: string, group: string, places: number): void;
  releaseBlock(shiftId: string, group: string): void;
  signUp(volunteer: string, shiftId: string, places: number): string;
  signUpRecord(id: string): SignUpView | undefined;
  coordinatorNotices(): string[];
  withdraw(id: string): void;
  cancelShift(id: string): void;
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const free = (a: App, s: string): number => a.shift(s)?.placesFree ?? Number.NaN;
const status = (a: App, u: string): string => a.signUpRecord(u)?.status ?? 'missing';

export const cases: TestCase[] = [
  {
    name: 'an opened shift shows its name and places',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Food bank, Saturday morning', 12);
      const v = a.shift(s);
      assert.deepEqual([v?.id, v?.name, v?.places, v?.placesFree], [s, 'Food bank, Saturday morning', 12, 12]);
      assert.equal(a.shift('S-9999'), undefined);
    },
  },
  {
    name: 'the coordinator blocks and releases places for a partner group',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Food bank, Saturday morning', 12);
      a.blockPlaces(s, 'Acme volunteering day', 5);
      assert.equal(free(a, s), 7);
      assert.throws(() => a.blockPlaces(s, 'St Mary school', 8), /not enough places: 7 free/);
      a.releaseBlock(s, 'Acme volunteering day');
      assert.equal(free(a, s), 12);
    },
  },
  {
    name: 'a sign-up is recorded and the coordinators are told',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Food bank, Saturday morning', 12);
      const u = a.signUp('Ana', s, 2);
      const v = a.signUpRecord(u);
      assert.deepEqual([v?.volunteer, v?.shiftId, v?.places], ['Ana', s, 2]);
      assert.ok(a.coordinatorNotices().some((n) => n.includes(`Sign-up ${u}`) && n.includes('Ana')));
    },
  },
  {
    name: 'a sign-up for an unknown shift or a bad number of places throws',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Food bank, Saturday morning', 12);
      assert.throws(() => a.signUp('Ana', 'S-9999', 1), /no shift/);
      assert.throws(() => a.signUp('Ana', s, 0), /1 to 6 places/);
      assert.throws(() => a.signUp('Ana', s, 7), /1 to 6 places/);
      assert.equal(free(a, s), 12);
    },
  },
  {
    name: 'a sign-up with enough places free is confirmed and takes its places',
    kind: 'feature',
    step: 'hold-places',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      const u = a.signUp('Ana', s, 3);
      assert.equal(status(a, u), 'confirmed');
      assert.equal(free(a, s), 2);
    },
  },
  {
    name: 'a sign-up without enough places is returned rejected, does not throw, and takes nothing',
    kind: 'feature',
    step: 'hold-places',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      a.blockPlaces(s, 'Acme volunteering day', 3);
      let u = '';
      assert.doesNotThrow(() => { u = a.signUp('Ben', s, 3); });
      assert.equal(status(a, u), 'rejected');
      assert.equal(free(a, s), 2);
      assert.equal(status(a, a.signUp('Cy', s, 2)), 'confirmed');
      assert.equal(free(a, s), 0);
    },
  },
  {
    name: 'a shift never gives out more places than it has',
    kind: 'feature',
    step: 'hold-places',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      const ids = ['Ana', 'Ben', 'Cy', 'Di'].map((v) => a.signUp(v, s, 2));
      assert.deepEqual(ids.map((u) => status(a, u)), ['confirmed', 'confirmed', 'rejected', 'rejected']);
      assert.equal(free(a, s), 1);
      assert.throws(() => a.blockPlaces(s, 'Acme volunteering day', 2), /not enough places: 1 free/);
    },
  },
  {
    name: 'a withdrawn sign-up frees its places at once',
    kind: 'feature',
    step: 'withdraw-sign-up',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      const u = a.signUp('Ana', s, 3);
      a.withdraw(u);
      assert.equal(status(a, u), 'withdrawn');
      assert.equal(free(a, s), 5);
      assert.equal(status(a, a.signUp('Ben', s, 5)), 'confirmed');
    },
  },
  {
    name: 'withdrawing twice, or withdrawing a rejected sign-up, returns normally and changes nothing; an unknown one throws',
    kind: 'feature',
    step: 'withdraw-sign-up',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      const u1 = a.signUp('Ana', s, 3);
      const u2 = a.signUp('Ben', s, 3);
      a.withdraw(u1);
      const u3 = a.signUp('Cy', s, 4);
      assert.doesNotThrow(() => a.withdraw(u1));
      assert.doesNotThrow(() => a.withdraw(u2));
      assert.deepEqual([status(a, u1), status(a, u2), status(a, u3)], ['withdrawn', 'rejected', 'confirmed']);
      assert.equal(free(a, s), 1);
      assert.throws(() => a.withdraw('U-9999'), /no sign-up U-9999/);
      assert.equal(free(a, s), 1);
    },
  },
  {
    name: 'sign-ups for a cancelled shift show it, and new sign-ups for it are returned rejected',
    kind: 'feature',
    step: 'shift-cancelled',
    run: (createApp) => {
      const a = app(createApp);
      const s = a.openShift('Park clean-up', 5);
      const other = a.openShift('Food bank, Saturday morning', 5);
      const u1 = a.signUp('Ana', s, 2);
      const u2 = a.signUp('Ben', s, 2);
      a.withdraw(u2);
      const u3 = a.signUp('Cy', other, 2);
      a.cancelShift(s);
      assert.deepEqual([status(a, u1), status(a, u2), status(a, u3)], ['shift-cancelled', 'withdrawn', 'confirmed']);
      const before = free(a, s);
      let u4 = '';
      assert.doesNotThrow(() => { u4 = a.signUp('Di', s, 1); });
      assert.equal(status(a, u4), 'rejected');
      assert.equal(free(a, s), before);
      assert.equal(status(a, a.signUp('Ed', other, 1)), 'confirmed');
      assert.throws(() => a.cancelShift('S-9999'), /no shift S-9999/);
    },
  },
];
