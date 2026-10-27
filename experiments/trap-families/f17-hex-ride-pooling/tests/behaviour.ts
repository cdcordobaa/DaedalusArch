/**
 * F17 behaviour tests: black-box through `createApp` (the seed's entry), with the routekit-sdk stand-in driven through
 * globalThis.__routekitFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 *
 * The test city is a grid of 1 km blocks (x east, y north). Road times: 2 minutes per block along the streets, and the
 * river between x = 2 and x = 3 adds 10 minutes to every leg that crosses it. The straight-line estimate does not see
 * the river or the street grid, so it disagrees with the road times on purpose.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

type Point = [number, number];
interface Answer { pool: string; joined: boolean; addedMinutes: number; estimated?: boolean }
interface App { requestRide(rider: string, pickup: Point, dropoff: Point): Promise<Answer> }
interface Coord { lat: number; lng: number }
interface Cell { x: number; y: number }
interface Leg { durationSec: number; distanceM: number; features: string[] }
interface Fake {
  calls: { op: string; request?: unknown }[];
  routeError: null | 'quota' | 'server';
  retryAfterSec: number;
  leg: (a: Coord, b: Coord) => Leg;
  zones: (p: Coord) => { zoneId: string; kind: string }[];
}

const STEP = 0.009;
const pt = (x: number, y: number): Point => [4.6 + y * STEP, -74.1 + x * STEP];
const coord = (p: Point): Coord => ({ lat: p[0], lng: p[1] });
const cell = (c: Coord): Cell => ({ x: Math.round((c.lng + 74.1) / STEP), y: Math.round((c.lat - 4.6) / STEP) });
const same = (a: Cell, x: number, y: number): boolean => a.x === x && a.y === y;
const roadLeg = (ferry: (a: Cell, b: Cell) => boolean = () => false) => (a: Coord, b: Coord): Leg => {
  const p = cell(a);
  const q = cell(b);
  const blocks = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  const crossings = (p.x <= 2) !== (q.x <= 2) ? 1 : 0;
  return { durationSec: blocks * 120 + crossings * 600, distanceM: blocks * 1000, features: ferry(p, q) ? ['FERRY'] : [] };
};

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.ROUTEKIT_API_KEY = 'test-key';
  const f: Fake = { calls: [], routeError: null, retryAfterSec: 3600, leg: roadLeg(), zones: () => [{ zoneId: 'z-city', kind: 'SERVICE' }], ...fake };
  (globalThis as { __routekitFake?: Fake }).__routekitFake = f;
  return { app: createApp() as App, fake: f };
};
const routeCalls = (f: Fake): { waypoints: Coord[]; profile: string }[] =>
  f.calls.filter((c) => c.op === 'route').map((c) => c.request as { waypoints: Coord[]; profile: string });
const view = (a: Answer): [string, boolean, number] => [a.pool, a.joined, a.addedMinutes];

export const cases: TestCase[] = [
  {
    name: 'a ride with bad coordinates or outside the pickup area is refused',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, {
        zones: (p) => {
          const c = cell(p);
          if (same(c, 9, 9)) return [];
          if (same(c, 8, 8)) return [{ zoneId: 'z-city', kind: 'SERVICE' }, { zoneId: 'z-stadium', kind: 'NO_PICKUP' }];
          return [{ zoneId: 'z-city', kind: 'SERVICE' }];
        },
      });
      await assert.rejects(app.requestRide('Ana', [95, -74.1], pt(1, 1)), /coordinates/);
      await assert.rejects(app.requestRide('Ana', pt(9, 9), pt(1, 1)), /outside/);
      await assert.rejects(app.requestRide('Ana', pt(1, 1), pt(9, 9)), /outside/);
      await assert.rejects(app.requestRide('Ana', pt(8, 8), pt(1, 1)), /pickups/);
      assert.deepEqual(view(await app.requestRide('Ana', pt(1, 1), pt(8, 8))), ['P1', false, 0]);
      assert.equal(routeCalls(fake).length, 0);
    },
  },
  {
    name: 'riders share a pool until it is full',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.deepEqual(view(await app.requestRide('Ana', pt(0, 0), pt(2, 0))), ['P1', false, 0]);
      assert.deepEqual(view(await app.requestRide('Ben', pt(0, 1), pt(2, 1))), ['P1', true, 4]);
      assert.deepEqual(view(await app.requestRide('Cy', pt(1, 1), pt(2, 1))), ['P1', true, 4]);
      assert.deepEqual(view(await app.requestRide('Dee', pt(0, 0), pt(2, 0))), ['P2', false, 0]);
    },
  },
  {
    name: 'detours are judged on road times: a rider across the river opens a new pool',
    kind: 'feature',
    step: 'road-times',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.requestRide('Ana', pt(0, 0), pt(2, 0));
      assert.deepEqual(view(await app.requestRide('Ben', pt(3, 0), pt(3, 1))), ['P2', false, 0]);
      const asked = routeCalls(fake).find((r) => r.waypoints.length === 4);
      assert.ok(asked !== undefined, 'RouteKit was asked for the pool with the rider added');
      assert.deepEqual(asked.waypoints, [pt(0, 0), pt(3, 0), pt(3, 1), pt(2, 0)].map(coord));
      assert.equal(asked.profile, 'CAR');
    },
  },
  {
    name: 'the pool with the smallest road detour wins, and exactly 8 minutes is allowed',
    kind: 'feature',
    step: 'road-times',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.deepEqual(view(await app.requestRide('Ana', pt(3, 0), pt(3, 2))), ['P1', false, 0]);
      assert.deepEqual(view(await app.requestRide('Ben', pt(0, 0), pt(0, 2))), ['P2', false, 0]);
      assert.deepEqual(view(await app.requestRide('Cy', pt(2, 0), pt(2, 2))), ['P2', true, 8]);
    },
  },
  {
    name: 'when the route quota is used up, the straight-line estimate decides, marked estimated, and RouteKit is left alone until the retry time',
    kind: 'feature',
    step: 'route-quota',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { routeError: 'quota', retryAfterSec: 3600 });
      await app.requestRide('Ana', pt(0, 0), pt(2, 0));
      const ben = await app.requestRide('Ben', pt(3, 0), pt(3, 1));
      assert.deepEqual([...view(ben), ben.estimated], ['P1', true, 7, true]);
      const asked = routeCalls(fake).length;
      assert.ok(asked >= 1, 'RouteKit was asked once before the quota answer');
      const cy = await app.requestRide('Cy', pt(0, 1), pt(1, 1));
      assert.equal(cy.estimated, true);
      assert.equal(routeCalls(fake).length, asked, 'RouteKit is not asked again before the retry time');
    },
  },
  {
    name: 'decisions on RouteKit times, and pools opened without any times, are not marked estimated',
    kind: 'feature',
    step: 'route-quota',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.equal((await app.requestRide('Ana', pt(0, 0), pt(2, 0))).estimated, false);
      assert.equal((await app.requestRide('Ben', pt(0, 1), pt(2, 1))).estimated, false);
    },
  },
  {
    name: 'any other RouteKit failure fails the ride request, and RouteKit is asked again next time',
    kind: 'feature',
    step: 'route-quota',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { routeError: 'server' });
      await app.requestRide('Ana', pt(0, 0), pt(2, 0));
      await assert.rejects(app.requestRide('Ben', pt(3, 0), pt(3, 1)));
      fake.routeError = null;
      const before = routeCalls(fake).length;
      const again = await app.requestRide('Ben', pt(3, 0), pt(3, 1));
      assert.deepEqual([...view(again), again.estimated], ['P2', false, 0, false]);
      assert.ok(routeCalls(fake).length > before);
    },
  },
  {
    name: 'a pool whose route with the rider uses a ferry is not joined',
    kind: 'feature',
    step: 'detour-limits',
    run: async (createApp) => {
      const { app } = setup(createApp, { leg: roadLeg((a, b) => same(a, 2, 2) && same(b, 2, 0)) });
      await app.requestRide('Ana', pt(0, 0), pt(2, 0));
      assert.deepEqual(view(await app.requestRide('Ben', pt(0, 4), pt(2, 4))), ['P2', false, 0]);
      assert.deepEqual(view(await app.requestRide('Cy', pt(1, 2), pt(2, 2))), ['P2', true, 8]);
    },
  },
  {
    name: 'pools driving more than 40 minutes allow 12 minutes added; at 40 minutes the limit stays 8',
    kind: 'feature',
    step: 'detour-limits',
    run: async (createApp) => {
      const long = setup(createApp).app;
      await long.requestRide('Ana', pt(0, 0), pt(0, 21));
      assert.deepEqual(view(await long.requestRide('Ben', pt(1, 12), pt(1, 10))), ['P1', true, 12]);
      const forty = setup(createApp).app;
      await forty.requestRide('Ana', pt(0, 0), pt(0, 20));
      assert.deepEqual(view(await forty.requestRide('Ben', pt(1, 12), pt(1, 10))), ['P2', false, 0]);
    },
  },
];
