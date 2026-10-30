/**
 * HX study set part B, hxb3 behaviour tests: black-box through `createApp` (the answers of the booking page), with the
 * nightdome-sdk stand-in driven through globalThis.__nightdomeFake. They pass on the clean and the trap end state;
 * feature cases fail on the seed. Answers are checked field by field (extra fields and headers are harmless); every
 * entry point a case calls is named in the step text.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

type Json = Record<string, unknown>;
interface Reply { status: number; headers: Record<string, string | undefined>; body: Json & Json[] }
interface App { evenings(month: string): Promise<Reply>; book(evening: string, adults: number, children: number): Promise<Reply> }
interface Ev { evening: string; seatsFree: number; telescope: string }
interface Fake { evenings: Ev[]; overcast?: { nextClear?: string }; calls: { op: string; input?: Json }[] }
const NOVEMBER = (): Ev[] => [
  { evening: '2026-11-12T20:00', seatsFree: 10, telescope: 'Zeiss refractor' },
  { evening: '2026-11-12T21:00', seatsFree: 0, telescope: 'Zeiss refractor' },
  { evening: '2026-11-12T22:30', seatsFree: 6, telescope: 'Dobsonian' },
  { evening: '2026-11-13T20:00', seatsFree: 2, telescope: 'Zeiss refractor' },
];
const setup = (createApp: (o?: Json) => unknown, overcast?: Fake['overcast']): { app: App; fake: Fake } => {
  process.env.NIGHTDOME_API_KEY = 'test-key';
  const fake: Fake = { evenings: NOVEMBER(), overcast, calls: [] };
  (globalThis as { __nightdomeFake?: Fake }).__nightdomeFake = fake;
  return { app: createApp() as App, fake };
};
const reserves = (fake: Fake): number => fake.calls.filter((c) => c.op === 'reserveSeats').length;

export const cases: TestCase[] = [
  {
    name: 'the evenings of a month are listed with the seats free',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const r = await app.evenings('2026-11');
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 4);
      assert.equal(r.body[0]!.evening, '2026-11-12T20:00');
      assert.equal(r.body[0]!.seatsFree, 10);
      assert.equal(r.body[1]!.seatsFree, 0);
      assert.equal(r.headers['Content-Language'], 'en');
    },
  },
  {
    name: 'a party is booked on an evening with seats',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const r = await app.book('2026-11-12T20:00', 2, 1);
      assert.equal(r.status, 201);
      assert.equal(r.body.evening, '2026-11-12T20:00');
      assert.equal(r.body.priceEuros, 30);
      assert.equal(typeof r.body.bookingRef, 'string');
      assert.equal(fake.calls.find((c) => c.op === 'reserveSeats')!.input!.seats, 3);
      const bad = await app.book('2026-11-12T20:00', 0, 2);
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error, 'a booking needs at least one adult');
    },
  },
  {
    name: 'a full evening answers 409',
    kind: 'feature',
    step: 'dome-full',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const r = await app.book('2026-11-12T21:00', 2, 0);
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'This evening is fully booked.');
      assert.equal((await app.book('2026-11-13T20:00', 3, 0)).status, 409);
      const unknown = await app.book('2026-11-14T20:00', 1, 0);
      assert.equal(unknown.status, 400, 'other refusals stay 400');
    },
  },
  {
    name: 'an overcast sky answers 423 with the next clear evening',
    kind: 'feature',
    step: 'clouded-out',
    run: async (createApp) => {
      const r = await setup(createApp, { nextClear: '2026-11-15T20:00' }).app.book('2026-11-12T20:00', 2, 0);
      assert.equal(r.status, 423);
      assert.equal(r.headers['Next-Clear-Evening'], '2026-11-15T20:00');
      assert.equal(r.body.error, 'Clouds tonight: the dome stays closed.');
      const silent = await setup(createApp, {}).app.book('2026-11-12T20:00', 2, 0);
      assert.equal(silent.status, 423);
      assert.equal(silent.headers['Next-Clear-Evening'], undefined);
    },
  },
  {
    name: 'late evenings are for adults only',
    kind: 'feature',
    step: 'late-evening',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const r = await app.book('2026-11-12T22:30', 2, 1);
      assert.equal(r.status, 400);
      assert.equal(r.body.error, 'Late evenings are for adults only.');
      assert.equal(reserves(fake), 0);
      assert.equal((await app.book('2026-11-12T22:30', 2, 0)).status, 201);
    },
  },
];
