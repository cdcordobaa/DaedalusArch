/**
 * F22 behaviour tests: black-box through `createApp` (the seed's entry, which returns the desk routes), with the clock
 * driven by the test. They must pass on the clean and the trap end state; feature cases fail on the seed.
 * Time zones used: on 2026-10-27/28 Zurich is UTC+1 (summer time ended 2026-10-25) and New York is UTC-4.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Reply { status: number; body: unknown }
type Handler = (...args: unknown[]) => Reply;
interface Desk {
  openLounge: Handler; addPartner: Handler; registerAirlinePass: Handler; sellDayPass: Handler;
  enter: Handler; leave: Handler; occupancy: Handler; addGuest: Handler;
}
type CreateApp = (o?: Record<string, unknown>) => unknown;

const setup = (createApp: CreateApp, start = '2026-10-27T12:00:00Z'): { desk: Desk; at: (t: string) => void } => {
  let now = start;
  const app = createApp({ now: () => now }) as { desk: Desk };
  return { desk: app.desk, at: (t) => { now = t; } };
};
const ok = (r: Reply): Record<string, unknown> => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown>;
};
const id = (r: Reply): string => String(ok(r).id);
const fails = (r: Reply, status: number, error: string): void => {
  assert.deepEqual([r.status, r.body], [status, { error }]);
};
/** A refusal whose answer may have changed shape later: only "not 200" and the message are checked. */
const refused = (r: Reply, error: string): void => {
  assert.notEqual(r.status, 200, JSON.stringify(r.body));
  assert.equal((r.body as { error?: unknown }).error, error);
};
const people = (desk: Desk, lounge: string): number => Number(ok(desk.occupancy(lounge)).people);

/** Partners LU (2 guests) and NW (1 guest); Alpine at ZRH (LU, NW) and Hudson at JFK (LU). */
const world = (createApp: CreateApp, start?: string, capacity = 6, cutoff?: number) => {
  const s = setup(createApp, start);
  ok(s.desk.addPartner(cutoff === undefined ? { airline: 'LU', guests: 2 } : { airline: 'LU', guests: 2, guestCutoff: cutoff }));
  ok(s.desk.addPartner({ airline: 'NW', guests: 1 }));
  const alpine = id(s.desk.openLounge({ name: 'Alpine', airport: 'ZRH', capacity, partners: ['LU', 'NW'] }));
  const hudson = id(s.desk.openLounge({ name: 'Hudson', airport: 'JFK', capacity, partners: ['LU'] }));
  const pass = (airline: string, holder = 'Ada'): string => id(s.desk.registerAirlinePass({ holder, airline }));
  return { ...s, alpine, hudson, pass };
};

export const cases: TestCase[] = [
  {
    name: 'an airline pass holder enters with guests, is counted, and leaves',
    kind: 'regression',
    run: (createApp) => {
      const w = world(createApp);
      assert.deepEqual([w.alpine, w.hudson], ['L-01', 'L-02']);
      const p = w.pass('LU');
      assert.equal(p, 'P-0001');
      const v = ok(w.desk.enter({ pass: p, lounge: w.alpine, guests: 2 }));
      assert.deepEqual(v, { visit: 'V-0001', lounge: 'L-01', guests: 2, enteredAt: '2026-10-27T12:00:00.000Z' });
      assert.deepEqual(ok(w.desk.occupancy(w.alpine)), { lounge: 'L-01', people: 3, capacity: 6 });
      w.at('2026-10-27T13:10:00Z');
      assert.deepEqual(ok(w.desk.leave('V-0001')), { visit: 'V-0001', leftAt: '2026-10-27T13:10:00.000Z' });
      assert.equal(people(w.desk, w.alpine), 0);
    },
  },
  {
    name: 'entry refusals: partner, allowance, already inside, unknown names, bad input',
    kind: 'regression',
    run: (createApp) => {
      const w = world(createApp);
      const nw = w.pass('NW');
      fails(w.desk.enter({ pass: nw, lounge: w.hudson }), 422, 'NW passes are not accepted at L-02');
      fails(w.desk.enter({ pass: nw, lounge: w.alpine, guests: 2 }), 422, 'NW allows at most 1 guest');
      fails(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 3 }), 422, 'LU allows at most 2 guests');
      fails(w.desk.enter({ pass: w.pass('XQ'), lounge: w.alpine }), 422, 'XQ passes are not accepted at L-01');
      ok(w.desk.enter({ pass: nw, lounge: w.alpine, guests: 1 }));
      fails(w.desk.enter({ pass: nw, lounge: w.alpine }), 422, `pass ${nw} is already inside`);
      fails(w.desk.enter({ pass: 'P-0999', lounge: w.alpine }), 404, 'no pass P-0999');
      fails(w.desk.enter({ pass: nw, lounge: 'L-99' }), 404, 'no lounge L-99');
      fails(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: -1 }), 400, 'guests must be a whole number from 0');
      fails(w.desk.leave('V-0999'), 404, 'no visit V-0999');
      ok(w.desk.leave('V-0001'));
      fails(w.desk.leave('V-0001'), 422, 'visit V-0001 has ended');
      fails(w.desk.openLounge({ name: 'Bad', airport: 'Zurich', capacity: 5, partners: [] }), 400, 'airport must be a three-letter code');
      fails(w.desk.addPartner({ airline: 'LU', guests: 6 }), 400, 'guest allowance must be a whole number from 0 to 5');
    },
  },
  {
    name: 'a day pass is good at its airport on its local calendar day, without guests',
    kind: 'regression',
    run: (createApp) => {
      const w = world(createApp, '2026-10-27T22:30:00Z');
      const day = id(w.desk.sellDayPass({ holder: 'Bo', airport: 'zrh', date: '2026-10-28' }));
      fails(w.desk.enter({ pass: day, lounge: w.alpine }), 422, `day pass ${day} is valid on 2026-10-28`);
      fails(w.desk.enter({ pass: day, lounge: w.hudson }), 422, `day pass ${day} is for ZRH`);
      w.at('2026-10-27T23:30:00Z');
      fails(w.desk.enter({ pass: day, lounge: w.alpine, guests: 1 }), 422, 'day passes allow no guests');
      ok(w.desk.enter({ pass: day, lounge: w.alpine }));
    },
  },
  {
    name: 'a full lounge turns entry away',
    kind: 'regression',
    run: (createApp) => {
      const w = world(createApp, undefined, 3);
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 2 }));
      refused(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine }), 'lounge L-01 is full');
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.hudson, guests: 2 }));
    },
  },
  {
    name: 'guests are refused from the partner cut-off until 05:00, lounge local time',
    kind: 'feature',
    step: 'guest-cutoff',
    run: (createApp) => {
      const w = world(createApp, '2026-10-27T20:30:00Z', 12, 21);
      fails(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 }), 422, 'no guests between 21:00 and 05:00 at ZRH');
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine }));
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.hudson, guests: 2 }));
      ok(w.desk.enter({ pass: w.pass('NW'), lounge: w.alpine, guests: 1 }));
      w.at('2026-10-27T19:59:00Z');
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 }));
      w.at('2026-10-28T03:59:00Z');
      fails(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 }), 422, 'no guests between 21:00 and 05:00 at ZRH');
      w.at('2026-10-28T04:00:00Z');
      ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 }));
    },
  },
  {
    name: 'a guest cut-off is a whole hour from 12 to 23',
    kind: 'feature',
    step: 'guest-cutoff',
    run: (createApp) => {
      const { desk } = setup(createApp);
      for (const h of [11, 24, 21.5]) fails(desk.addPartner({ airline: 'LU', guests: 1, guestCutoff: h }), 400, 'guest cut-off must be a whole hour from 12 to 23');
      ok(desk.addPartner({ airline: 'LU', guests: 1, guestCutoff: 12 }));
      ok(desk.addPartner({ airline: 'NW', guests: 1, guestCutoff: 23 }));
    },
  },
  {
    name: 'a guest joins a visit in progress and is counted',
    kind: 'feature',
    step: 'late-guest',
    run: (createApp) => {
      const w = world(createApp);
      const v = String(ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 })).visit);
      assert.deepEqual(ok(w.desk.addGuest(v)), { visit: v, guests: 2 });
      assert.equal(people(w.desk, w.alpine), 3);
      fails(w.desk.addGuest(v), 422, 'LU allows at most 2 guests');
      const nwVisit = String(ok(w.desk.enter({ pass: w.pass('NW'), lounge: w.alpine })).visit);
      assert.deepEqual(ok(w.desk.addGuest(nwVisit)), { visit: nwVisit, guests: 1 });
      fails(w.desk.addGuest(nwVisit), 422, 'NW allows at most 1 guest');
      fails(w.desk.addGuest('V-0999'), 404, 'no visit V-0999');
      ok(w.desk.leave(v));
      fails(w.desk.addGuest(v), 422, `visit ${v} has ended`);
      assert.equal(people(w.desk, w.alpine), 2);
    },
  },
  {
    name: 'a late guest follows the day-pass, cut-off and room rules',
    kind: 'feature',
    step: 'late-guest',
    run: (createApp) => {
      const w = world(createApp, '2026-10-27T19:00:00Z', 3, 21);
      const day = id(w.desk.sellDayPass({ holder: 'Bo', airport: 'ZRH', date: '2026-10-27' }));
      const dayVisit = String(ok(w.desk.enter({ pass: day, lounge: w.alpine })).visit);
      fails(w.desk.addGuest(dayVisit), 422, 'day passes allow no guests');
      const lu = String(ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine })).visit);
      const ny = String(ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.hudson })).visit);
      w.at('2026-10-27T20:30:00Z');
      ok(w.desk.addGuest(ny));
      fails(w.desk.addGuest(lu), 422, 'no guests between 21:00 and 05:00 at ZRH');
      w.at('2026-10-28T04:30:00Z');
      ok(w.desk.addGuest(lu));
      refused(w.desk.addGuest(lu), 'lounge L-01 is full');
      assert.equal(people(w.desk, w.alpine), 3);
    },
  },
  {
    name: 'a full lounge answers 503 with the minutes until the longest visit reaches three hours',
    kind: 'feature',
    step: 'full-answer',
    run: (createApp) => {
      const w = world(createApp, '2026-10-27T10:00:00Z', 3);
      const a = String(ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1 })).visit);
      w.at('2026-10-27T10:40:00Z');
      ok(w.desk.enter({ pass: w.pass('NW'), lounge: w.alpine }));
      w.at('2026-10-27T11:15:30Z');
      const late = w.pass('LU');
      assert.deepEqual(w.desk.enter({ pass: late, lounge: w.alpine }), { status: 503, body: { error: 'lounge L-01 is full', retryAfterMinutes: 105 } });
      ok(w.desk.leave(a));
      ok(w.desk.enter({ pass: late, lounge: w.alpine, guests: 1 }));
      assert.deepEqual(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine }), { status: 503, body: { error: 'lounge L-01 is full', retryAfterMinutes: 145 } });
      w.at('2026-10-27T14:00:00Z');
      assert.deepEqual(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine }), { status: 503, body: { error: 'lounge L-01 is full', retryAfterMinutes: 1 } });
    },
  },
  {
    name: 'a late guest into a full lounge gets the same answer; other refusals keep theirs',
    kind: 'feature',
    step: 'full-answer',
    run: (createApp) => {
      const w = world(createApp, '2026-10-27T10:00:00Z', 2);
      const v = String(ok(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine })).visit);
      w.at('2026-10-27T10:20:00Z');
      ok(w.desk.enter({ pass: w.pass('NW'), lounge: w.alpine }));
      w.at('2026-10-27T11:00:00Z');
      assert.deepEqual(w.desk.addGuest(v), { status: 503, body: { error: 'lounge L-01 is full', retryAfterMinutes: 120 } });
      fails(w.desk.enter({ pass: w.pass('NW'), lounge: w.hudson }), 422, 'NW passes are not accepted at L-02');
      fails(w.desk.enter({ pass: 'P-0999', lounge: w.alpine }), 404, 'no pass P-0999');
      fails(w.desk.enter({ pass: w.pass('LU'), lounge: w.alpine, guests: 1.5 }), 400, 'guests must be a whole number from 0');
    },
  },
];
