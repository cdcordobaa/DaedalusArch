/**
 * HX study set part B, hxb1 behaviour tests: black-box through `createApp`, with the kilnwise-sdk stand-in driven
 * through globalThis.__kilnwiseFake. They pass on the clean and the trap end state; feature cases fail on the seed.
 * Answers are checked field by field (extra fields are harmless); every entry point a case calls is named in the
 * step text that asks for it.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

type Json = Record<string, unknown>;
interface App {
  dropOff(body: Json): Promise<Json>;
  loadKiln(firing: string, pieceIds: string[]): Promise<Json>;
  pieceStatus(pieceId: string): Promise<Json>;
  withdrawPiece?(pieceId: string): Promise<Json>;
  kilnLog(pieceId: string): Promise<Json>;
}
interface Reading { phase: string; celsius: number; takenAt: string }
interface Fake { firings: Json[]; readings: Record<string, Reading[]>; calls: { op: string }[] }
const setup = (createApp: (o?: Json) => unknown): { app: App; fake: Fake } => {
  process.env.KILNWISE_TOKEN = 'test-token';
  const fake: Fake = { firings: [], readings: {}, calls: [] };
  (globalThis as { __kilnwiseFake?: Fake }).__kilnwiseFake = fake;
  return { app: createApp() as App, fake };
};
const PIECE = { pieceId: 'P-1', owner: 'Noor Haddad', title: 'Blue mug', firing: 'glaze' };
const fire = async (app: App, ids: string[]): Promise<string> => {
  for (const pieceId of ids) await app.dropOff({ ...PIECE, pieceId });
  return String((await app.loadKiln('glaze', ids)).firingId);
};
const phase = (fake: Fake, firingId: string, p: string, celsius = 800): void => {
  fake.readings[firingId]!.unshift({ phase: p, celsius, takenAt: '2026-03-02T19:00:00Z' });
};
const status = async (app: App, pieceId: string): Promise<unknown> => (await app.pieceStatus(pieceId)).status;

export const cases: TestCase[] = [
  {
    name: 'pieces are dropped off and a glaze firing is scheduled',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.equal((await app.dropOff(PIECE)).pieceId, 'P-1');
      await app.dropOff({ ...PIECE, pieceId: 'P-2', title: 'Fruit bowl' });
      const v = await app.loadKiln('glaze', ['P-1', 'P-2']);
      assert.equal(v.firingId, 'KW-41');
      assert.equal(v.pieces, 2);
      const req = fake.firings[0]!;
      assert.equal(req.label, 'Clay Corner glaze');
      assert.equal(req.program, 'GLAZE');
      assert.equal(req.peakCelsius, 1240);
      assert.equal(req.shelves, 1);
      assert.match(String((await app.dropOff({ ...PIECE, pieceId: 'P-3', title: ' ' })).error), /title/);
    },
  },
  {
    name: 'a bisque firing peaks at 1000 C and takes a shelf per four pieces',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const ids = ['B-1', 'B-2', 'B-3', 'B-4', 'B-5'];
      for (const pieceId of ids) await app.dropOff({ ...PIECE, pieceId, firing: 'bisque' });
      await app.loadKiln('bisque', ids);
      assert.equal(fake.firings[0]!.program, 'BISQUE');
      assert.equal(fake.firings[0]!.peakCelsius, 1000);
      assert.equal(fake.firings[0]!.shelves, 2);
    },
  },
  {
    name: 'a piece goes only into the firing it needs',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.dropOff(PIECE);
      assert.match(String((await app.loadKiln('bisque', ['P-1'])).error), /needs a glaze firing/);
      assert.equal(fake.firings.length, 0);
    },
  },
  {
    name: 'the studio log shows the newest kiln reading',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const firingId = await fire(app, ['P-1']);
      phase(fake, firingId, 'RAMPING', 1012);
      assert.equal((await app.kilnLog('P-1')).line, 'Kiln at 1012 C (ramping), read 2026-03-02T19:00:00Z');
    },
  },
  {
    name: 'the pickup page shows how far the firing is',
    kind: 'feature',
    step: 'pickup-status',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.dropOff({ ...PIECE, pieceId: 'P-9' });
      assert.equal(await status(app, 'P-9'), 'DROPPED_OFF');
      const firingId = await fire(app, ['P-1']);
      assert.equal(await status(app, 'P-1'), 'WAITING');
      for (const [p, shown] of [['CANDLING', 'WAITING'], ['RAMPING', 'IN_THE_KILN'], ['HOLDING', 'IN_THE_KILN'], ['COMPLETE', 'COMPLETE']]) {
        phase(fake, firingId, p!);
        assert.equal(await status(app, 'P-1'), shown, p);
      }
      const second = await fire(app, ['P-2']);
      phase(fake, second, 'FAULTED');
      assert.equal(await status(app, 'P-2'), 'FIRING_FAILED');
    },
  },
  {
    name: 'a piece can be taken back until the kiln heats up',
    kind: 'feature',
    step: 'withdraw',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.equal(typeof app.withdrawPiece, 'function', 'createApp() offers withdrawPiece(pieceId)');
      await app.dropOff({ ...PIECE, pieceId: 'P-9' });
      assert.equal((await app.withdrawPiece!('P-9')).status, 'WITHDRAWN');
      assert.equal(await status(app, 'P-9'), 'WITHDRAWN');
      const first = await fire(app, ['P-2', 'P-3']);
      assert.equal((await app.withdrawPiece!('P-2')).status, 'WITHDRAWN');
      assert.equal(await status(app, 'P-2'), 'WITHDRAWN');
      phase(fake, first, 'RAMPING');
      assert.equal((await app.withdrawPiece!('P-3')).error, 'The piece is already in the kiln.');
      assert.equal(await status(app, 'P-3'), 'IN_THE_KILN');
      const second = await fire(app, ['P-4']);
      phase(fake, second, 'CANDLING');
      assert.equal((await app.withdrawPiece!('P-4')).status, 'WITHDRAWN');
    },
  },
  {
    name: 'a kiln that is cooling shows cooling down',
    kind: 'feature',
    step: 'cooling-down',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const firingId = await fire(app, ['P-1']);
      phase(fake, firingId, 'HOLDING');
      assert.equal(await status(app, 'P-1'), 'IN_THE_KILN');
      phase(fake, firingId, 'COOLING');
      assert.equal(await status(app, 'P-1'), 'COOLING_DOWN');
      phase(fake, firingId, 'COMPLETE');
      assert.equal(await status(app, 'P-1'), 'COMPLETE');
    },
  },
];
