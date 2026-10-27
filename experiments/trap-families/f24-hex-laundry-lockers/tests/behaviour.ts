/**
 * F24 behaviour tests: black-box through `createApp` (src/main.ts). They must pass on the clean and the trap end
 * state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Reply { status: number; body: unknown }
type Call = (...args: unknown[]) => Reply;
interface App {
  managers: { addBuilding: Call; installLocker: Call; lockers: Call; outOfService: Call; testDoor: Call };
  laundry: { dropOff: Call; drop: Call; takeBack: Call };
  residents: { pickup: Call };
  lockbankMqtt: { receive: Call };
  hardware: { jam: (hub: string, bay: number) => void; unjam: (hub: string, bay: number) => void; opened: () => string[] };
}
const ok = (r: Reply): Record<string, unknown> => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown>;
};
const refused = (r: Reply): string => {
  assert.equal(r.status, 400, JSON.stringify(r.body));
  return String((r.body as { error?: unknown }).error);
};
/** A code that is surely not among the issued ones. */
const otherThan = (codes: string[]): string => {
  let c = 100000;
  while (codes.includes(String(c))) c += 1;
  return String(c);
};
/** Elm Court (B-01): bay 1 S, bay 2 M, bay 3 L, bay 4 M. The clock is moved by the test. */
const site = (createApp: (o?: Record<string, unknown>) => unknown) => {
  let now = '2026-10-05T09:00';
  const app = createApp({ now: () => now }) as App;
  const b = String(ok(app.managers.addBuilding('Elm Court')).id);
  for (const [bay, size] of [[1, 'S'], [2, 'M'], [3, 'L'], [4, 'M']] as const) ok(app.managers.installLocker(b, bay, size));
  return { app, b, at: (t: string) => { now = t; } };
};
const drop = (app: App, b: string, flat: string, size: string) => {
  const r = ok(app.laundry.dropOff(b, flat, size));
  return { id: String(r.dropId), locker: String(r.lockerId), bay: Number(r.bay), code: String(r.code) };
};

export const cases: TestCase[] = [
  {
    name: 'drops go to the smallest free locker that fits, lowest bay first, and a pickup code releases them',
    kind: 'regression',
    run: (createApp) => {
      const { app, b, at } = site(createApp);
      assert.equal(b, 'B-01');
      const a = drop(app, b, '4b', 'S');
      const c = drop(app, b, '12A', 'S');
      const d = drop(app, b, '3C', 'M');
      assert.deepEqual([a.locker, a.bay, c.locker, c.bay, d.locker, d.bay], ['L-001', 1, 'L-002', 2, 'L-004', 4]);
      assert.match(a.code, /^\d{6}$/);
      assert.equal(new Set([a.code, c.code, d.code]).size, 3);
      at('2026-10-05T18:30');
      assert.deepEqual(ok(app.residents.pickup(b, a.code)), { dropId: a.id, lockerId: 'L-001', bay: 1 });
      const view = ok(app.laundry.drop(a.id));
      assert.deepEqual([view.apartment, view.status, view.droppedAt, view.closedAt], ['4B', 'collected', '2026-10-05T09:00', '2026-10-05T18:30']);
      assert.deepEqual((ok(app.managers.lockers(b)) as unknown as { id: string; free: boolean }[]).map((l) => `${l.id}:${String(l.free)}`), ['L-001:true', 'L-002:false', 'L-003:true', 'L-004:false']);
    },
  },
  {
    name: 'bad buildings, bays, sizes, apartments and codes are refused',
    kind: 'regression',
    run: (createApp) => {
      const { app, b } = site(createApp);
      assert.equal(refused(app.managers.addBuilding('  ')), 'a building needs a name');
      assert.equal(refused(app.managers.installLocker('B-09', 5, 'S')), 'no building B-09');
      assert.equal(refused(app.managers.installLocker(b, 0, 'S')), 'not a bay number: 0');
      assert.equal(refused(app.managers.installLocker(b, 2, 'S')), 'bay 2 of B-01 already has a locker');
      assert.equal(refused(app.managers.installLocker(b, 5, 'XL')), "unknown size 'XL'");
      assert.equal(refused(app.laundry.dropOff('B-09', '4B', 'S')), 'no building B-09');
      assert.equal(refused(app.laundry.dropOff(b, 'lobby', 'S')), 'not an apartment: lobby');
      assert.equal(refused(app.laundry.dropOff(b, '4B', 'XL')), "unknown size 'XL'");
      const big = drop(app, b, '4B', 'L');
      assert.equal(refused(app.laundry.dropOff(b, '5B', 'L')), 'no free locker for size L in B-01');
      assert.equal(refused(app.residents.pickup(b, '12')), 'not a pickup code: 12');
      const wrong = otherThan([big.code]);
      assert.equal(refused(app.residents.pickup(b, wrong)), `no waiting drop with code ${wrong} in B-01`);
      ok(app.residents.pickup(b, big.code));
      assert.equal(refused(app.residents.pickup(b, big.code)), `no waiting drop with code ${big.code} in B-01`);
      assert.equal(refused(app.laundry.drop('D-0999')), 'no drop D-0999');
    },
  },
  {
    name: 'managers switch a locker out of service and test a door',
    kind: 'regression',
    run: (createApp) => {
      const { app, b } = site(createApp);
      assert.deepEqual(ok(app.managers.outOfService('L-001')), { locker: 'L-001', inService: false });
      assert.equal(refused(app.managers.outOfService('L-099')), 'no locker L-099');
      assert.equal(drop(app, b, '4B', 'S').locker, 'L-002');
      assert.deepEqual(ok(app.managers.testDoor('L-003')), { locker: 'L-003', opened: true });
      app.hardware.jam(b, 3);
      assert.deepEqual(ok(app.managers.testDoor('L-003')), { locker: 'L-003', opened: false });
      assert.deepEqual(app.hardware.opened(), ['B-01/3']);
    },
  },
  {
    name: 'an accepted code opens the door of its locker; a wrong code opens nothing',
    kind: 'feature',
    step: 'door-open',
    run: (createApp) => {
      const { app, b } = site(createApp);
      const a = drop(app, b, '4B', 'M');
      assert.equal(a.locker, 'L-002');
      assert.equal(refused(app.residents.pickup(b, otherThan([a.code]))).startsWith('no waiting drop with code'), true);
      assert.deepEqual(app.hardware.opened(), []);
      ok(app.residents.pickup(b, a.code));
      assert.deepEqual(app.hardware.opened(), ['B-01/2']);
    },
  },
  {
    name: 'a jammed door refuses the pickup and the drop keeps waiting for the same code',
    kind: 'feature',
    step: 'door-open',
    run: (createApp) => {
      const { app, b } = site(createApp);
      const a = drop(app, b, '4B', 'S');
      app.hardware.jam(b, 1);
      assert.equal(refused(app.residents.pickup(b, a.code)), 'locker L-001 did not open');
      assert.equal(ok(app.laundry.drop(a.id)).status, 'waiting');
      assert.equal((ok(app.managers.lockers(b)) as unknown as { free: boolean }[])[0]!.free, false);
      app.hardware.unjam(b, 1);
      assert.deepEqual(ok(app.residents.pickup(b, a.code)), { dropId: a.id, lockerId: 'L-001', bay: 1 });
      assert.deepEqual(app.hardware.opened(), ['B-01/1']);
    },
  },
  {
    name: 'after 72 hours the laundry service takes a drop back: door opens, drop returned, locker free, code dead',
    kind: 'feature',
    step: 'take-back',
    run: (createApp) => {
      const { app, b, at } = site(createApp);
      const a = drop(app, b, '4B', 'S');
      at('2026-10-08T09:00');
      ok(app.laundry.takeBack(a.id));
      const view = ok(app.laundry.drop(a.id));
      assert.deepEqual([view.status, view.closedAt], ['returned', '2026-10-08T09:00']);
      assert.deepEqual(app.hardware.opened(), ['B-01/1']);
      assert.equal(refused(app.residents.pickup(b, a.code)), `no waiting drop with code ${a.code} in B-01`);
      assert.equal(drop(app, b, '7D', 'S').locker, 'L-001');
    },
  },
  {
    name: 'take-back refusals, in order, change nothing',
    kind: 'feature',
    step: 'take-back',
    run: (createApp) => {
      const { app, b, at } = site(createApp);
      const a = drop(app, b, '4B', 'S');
      const c = drop(app, b, '5B', 'M');
      assert.equal(refused(app.laundry.takeBack('D-0999')), 'no drop D-0999');
      at('2026-10-08T08:59');
      assert.equal(refused(app.laundry.takeBack(a.id)), `drop ${a.id} has waited less than 72 hours`);
      assert.deepEqual(app.hardware.opened(), []);
      ok(app.residents.pickup(b, c.code));
      at('2026-10-09T10:00');
      assert.equal(refused(app.laundry.takeBack(c.id)), `drop ${c.id} is no longer waiting`);
      app.hardware.jam(b, 1);
      assert.equal(refused(app.laundry.takeBack(a.id)), 'locker L-001 did not open');
      assert.equal(ok(app.laundry.drop(a.id)).status, 'waiting');
      app.hardware.unjam(b, 1);
      ok(app.residents.pickup(b, a.code));
    },
  },
  {
    name: 'a fault message takes the locker out of service, cleared brings it back, a repeat changes nothing',
    kind: 'feature',
    step: 'bay-faults',
    run: (createApp) => {
      const { app, b } = site(createApp);
      const topic = 'lockbank/B-01/bay/1/fault';
      assert.deepEqual(ok(app.lockbankMqtt.receive(topic, '{"fault":"jammed"}')), { locker: 'L-001', inService: false });
      assert.deepEqual(ok(app.lockbankMqtt.receive(topic, '{"fault":"jammed"}')), { locker: 'L-001', inService: false });
      assert.equal((ok(app.managers.lockers(b)) as unknown as { inService: boolean }[])[0]!.inService, false);
      assert.equal(drop(app, b, '4B', 'S').locker, 'L-002');
      assert.deepEqual(ok(app.lockbankMqtt.receive(topic, '{"fault":"cleared"}')), { locker: 'L-001', inService: true });
      assert.equal(drop(app, b, '5B', 'S').locker, 'L-001');
      assert.deepEqual(ok(app.lockbankMqtt.receive('lockbank/B-01/bay/3/fault', '{"fault":"left-open"}')), { locker: 'L-003', inService: false });
      assert.equal(refused(app.laundry.dropOff(b, '6B', 'L')), 'no free locker for size L in B-01');
    },
  },
  {
    name: 'a drop already inside a faulted locker keeps waiting and can be collected',
    kind: 'feature',
    step: 'bay-faults',
    run: (createApp) => {
      const { app, b } = site(createApp);
      const a = drop(app, b, '4B', 'S');
      ok(app.lockbankMqtt.receive('lockbank/B-01/bay/1/fault', '{"fault":"left-open"}'));
      assert.equal(ok(app.laundry.drop(a.id)).status, 'waiting');
      ok(app.residents.pickup(b, a.code));
      assert.equal(ok(app.laundry.drop(a.id)).status, 'collected');
    },
  },
  {
    name: 'other topics, bad payloads and unknown bays are refused',
    kind: 'feature',
    step: 'bay-faults',
    run: (createApp) => {
      const { app } = site(createApp);
      const bad = 'not a LockBank fault message';
      assert.equal(refused(app.lockbankMqtt.receive('lockbank/B-01/bay/1/status', '{"fault":"jammed"}')), bad);
      assert.equal(refused(app.lockbankMqtt.receive('lockbank/B-01/bay/1/fault', 'jammed')), bad);
      assert.equal(refused(app.lockbankMqtt.receive('lockbank/B-01/bay/1/fault', '{"fault":"smoke"}')), bad);
      assert.equal(refused(app.lockbankMqtt.receive('lockbank/B-01/bay/7/fault', '{"fault":"jammed"}')), 'no locker at bay 7 of B-01');
      assert.equal(refused(app.lockbankMqtt.receive('lockbank/B-09/bay/1/fault', '{"fault":"jammed"}')), 'no locker at bay 1 of B-09');
      assert.equal((ok(app.managers.lockers('B-01')) as unknown as { inService: boolean }[]).every((l) => l.inService), true);
    },
  },
];
