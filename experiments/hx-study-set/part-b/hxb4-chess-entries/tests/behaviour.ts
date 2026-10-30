/**
 * HX study set part B, hxb4 behaviour tests: black-box through `createApp` (the answers of the entry form), with the
 * ratingsdesk-sdk stand-in driven through globalThis.__ratingsdeskFake. They pass on the clean and the trap end
 * state; feature cases fail on the seed. Answers are checked field by field (extra fields and headers are harmless);
 * every entry point a case calls is named in the step text.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

type Json = Record<string, unknown>;
interface Reply { status: number; headers: Record<string, string | undefined>; body: Json & Json[] }
interface App { enterPlayer(federationId: string, section: string): Promise<Reply>; roster(section: string): Promise<Reply> }
interface Fake { players: Record<string, { fullName: string; standardRating: number }>; throttle?: { reset?: string }; calls: { op: string }[] }
const setup = (createApp: (o?: Json) => unknown, throttle?: Fake['throttle']): { app: App; fake: Fake } => {
  process.env.RATINGSDESK_CLIENT_ID = 'test-client';
  process.env.RATINGSDESK_SECRET = 'test-secret';
  const players: Fake['players'] = { '4100018': { fullName: 'Ada Okafor', standardRating: 2050 }, '4100026': { fullName: 'Pim Verhoef', standardRating: 1650 } };
  for (let i = 1; i <= 66; i++) players[String(7700000 + i)] = { fullName: 'Club player ' + String(i), standardRating: 1400 + i };
  const fake: Fake = { players, throttle, calls: [] };
  (globalThis as { __ratingsdeskFake?: Fake }).__ratingsdeskFake = fake;
  return { app: createApp() as App, fake };
};
const lookups = (fake: Fake): number => fake.calls.filter((c) => c.op === 'players.lookup').length;

export const cases: TestCase[] = [
  {
    name: 'a rated player enters the open section',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const r = await app.enterPlayer('4100018', 'open');
      assert.equal(r.status, 201);
      assert.equal(r.body.name, 'Ada Okafor');
      assert.equal(r.body.rating, 2050);
      assert.equal(r.body.section, 'open');
      assert.equal(r.body.feeEuros, 35);
      assert.equal(r.headers['Content-Type'], 'application/json');
      const list = await app.roster('open');
      assert.equal(list.status, 200);
      assert.equal(list.body.length, 1);
    },
  },
  {
    name: 'the amateur section is for ratings under 1800',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const strong = await app.enterPlayer('4100018', 'amateur');
      assert.equal(strong.status, 422);
      assert.match(String(strong.body.error), /under 1800/);
      const r = await app.enterPlayer('4100026', 'amateur');
      assert.equal(r.status, 201);
      assert.equal(r.body.feeEuros, 25);
    },
  },
  {
    name: 'a player enters a section once',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      await app.enterPlayer('4100018', 'open');
      const again = await app.enterPlayer('4100018', 'open');
      assert.equal(again.status, 422);
      assert.equal((await app.enterPlayer('12ab', 'open')).status, 422);
    },
  },
  {
    name: 'an unknown federation id answers 404',
    kind: 'feature',
    step: 'unknown-player',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const r = await app.enterPlayer('999999', 'open');
      assert.equal(r.status, 404);
      assert.equal(r.body.error, 'No player with this federation id.');
      assert.equal((await app.enterPlayer('12ab', 'open')).status, 422, 'other refusals stay 422');
    },
  },
  {
    name: 'a throttled rating list answers 503 with Retry-After',
    kind: 'feature',
    step: 'throttled',
    run: async (createApp) => {
      const r = await setup(createApp, { reset: '12' }).app.enterPlayer('4100018', 'open');
      assert.equal(r.status, 503);
      assert.equal(r.headers['Retry-After'], '12');
      assert.equal(r.body.error, 'Registration is busy, please try again shortly.');
      const silent = await setup(createApp, {}).app.enterPlayer('4100018', 'open');
      assert.equal(silent.status, 503);
      assert.equal(silent.headers['Retry-After'], '20');
    },
  },
  {
    name: 'a section takes at most 64 players',
    kind: 'feature',
    step: 'section-full',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      for (let i = 1; i <= 64; i++) assert.equal((await app.enterPlayer(String(7700000 + i), 'amateur')).status, 201);
      const before = lookups(fake);
      const r = await app.enterPlayer('7700065', 'amateur');
      assert.equal(r.status, 422);
      assert.equal(r.body.error, 'This section is full.');
      assert.equal(lookups(fake), before, 'the rating list is not asked');
      assert.equal((await app.enterPlayer('7700066', 'open')).status, 201);
    },
  },
];
