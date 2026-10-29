/**
 * TRAP-PILOT-v2 P4 behaviour tests (levers: a, b, c, d, e, f): black-box through `createApp`, with the
 * slotbook-sdk stand-in driven through globalThis.__slotbookFake. They pass on the clean and the trap end state;
 * feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

type Json = Record<string, unknown>;
interface App { freeSlots(day: string): Promise<Json[] | Json>; book(patientId: string, slotId: string, day: string): Promise<Json> }
interface Fake { slots: Json[]; fail?: { code: string; retryAfterSec?: number }; calls: { op: string }[] }
const slot = (slotId: string, startsAt: string): Json => ({ slotId, chairId: 'chair-1', startsAt, durationMin: 30 });
const DAY = [slot('S1', '2026-05-04T09:00'), slot('S2', '2026-05-04T09:30'), slot('S3', '2026-05-04T11:00'), slot('S9', '2026-05-05T09:00')];
const setup = (createApp: (o?: Json) => unknown, fail?: Fake['fail'], slots = DAY): { app: App; fake: Fake } => {
  process.env.SLOTBOOK_API_KEY = 'test-key';
  const fake: Fake = { slots: slots.map((s) => ({ ...s })), fail, calls: [] };
  (globalThis as { __slotbookFake?: Fake }).__slotbookFake = fake;
  return { app: createApp() as App, fake };
};
const reserves = (f: Fake): number => f.calls.filter((c) => c.op === 'reserve').length;

export const cases: TestCase[] = [
  {
    name: 'free slots of a day are listed in order',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.deepEqual(await app.freeSlots('2026-05-04'), [
        { slotId: 'S1', startsAt: '2026-05-04T09:00', minutes: 30 },
        { slotId: 'S2', startsAt: '2026-05-04T09:30', minutes: 30 },
        { slotId: 'S3', startsAt: '2026-05-04T11:00', minutes: 30 },
      ]);
      assert.match(String((await app.freeSlots('4 May') as Json).error), /YYYY-MM-DD/);
    },
  },
  {
    name: 'a free slot is booked',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.deepEqual(await app.book('P-1', 'S2', '2026-05-04'), { status: 'booked', reservationId: 'R-S2', slotId: 'S2' });
    },
  },
  {
    name: 'a patient with an open bill is refused with our own code',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.deepEqual(await app.book('P-9', 'S2', '2026-05-04'), { error: 'Please settle your open bill first.', code: 'OPEN_BILL' });
      assert.equal(reserves(fake), 0);
    },
  },
  {
    name: 'a slot taken in the meantime answers the next free slot of the day',
    kind: 'feature',
    step: 'slot-taken',
    run: async (createApp) => {
      const { app } = setup(createApp, { code: 'SLOT_TAKEN' });
      assert.deepEqual(await app.book('P-1', 'S1', '2026-05-04'), { status: 'taken', suggestion: '2026-05-04T09:30', code: 'SLOT_TAKEN' });
      const full = setup(createApp, { code: 'SLOT_TAKEN' }, [slot('S1', '2026-05-04T09:00')]);
      assert.deepEqual(await full.app.book('P-1', 'S1', '2026-05-04'), { status: 'taken', suggestion: null, code: 'SLOT_TAKEN' });
    },
  },
  {
    name: 'a busy calendar asks the patient to try again later',
    kind: 'feature',
    step: 'busy-calendar',
    run: async (createApp) => {
      const { app } = setup(createApp, { code: 'RATE_LIMITED', retryAfterSec: 12 });
      assert.deepEqual(await app.book('P-1', 'S1', '2026-05-04'), { status: 'try_later', retryIn: 12, code: 'RATE_LIMITED' });
      const silent = setup(createApp, { code: 'RATE_LIMITED' });
      assert.deepEqual(await silent.app.book('P-1', 'S1', '2026-05-04'), { status: 'try_later', retryIn: 30, code: 'RATE_LIMITED' });
      const other = await setup(createApp, { code: 'OUTSIDE_OPENING' }).app.book('P-1', 'S1', '2026-05-04');
      assert.equal(typeof other.error, 'string', 'other refusals stay errors');
    },
  },
  {
    name: 'a calendar locked for the night says when booking reopens',
    kind: 'feature',
    step: 'night-lock',
    run: async (createApp) => {
      const { app } = setup(createApp, { code: 'CALENDAR_LOCKED' });
      assert.deepEqual(await app.book('P-1', 'S1', '2026-05-04'), { status: 'closed', reason: 'Online booking reopens at 7:00.' });
    },
  },
];
