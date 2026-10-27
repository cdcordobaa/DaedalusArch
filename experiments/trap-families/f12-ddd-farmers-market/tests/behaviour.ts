/**
 * F12 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Sheet { vendorId: string; tradingName: string; inspectionScore: number | null; strikes: number; status: string; lastTraded: string | null }
interface App {
  registerVendor(tradingName: string): string;
  recordInspection(vendorId: string, score: number): void;
  issueStrike(vendorId: string): void;
  licence(vendorId: string): Sheet | undefined;
  openDay(date: string, pitches: { code: string; kind: string }[]): void;
  book(date: string, pitch: string, vendorId: string): { ref: string; pitch: string; fee: number };
  checkIn(date: string, vendorId: string): void;
  reportNoShow(date: string, pitch: string): void;
  pitchPlan(date: string): string[];
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const LAYOUT = [{ code: 'H1', kind: 'hall' }, { code: 'H2', kind: 'hall' }, { code: 'O1', kind: 'open' }, { code: 'O2', kind: 'open' }, { code: 'O3', kind: 'open' }];
const SAT = '2026-11-07';
const vendor = (a: App, name: string, score: number | null, strikes = 0): string => {
  const id = a.registerVendor(name);
  if (score !== null) a.recordInspection(id, score);
  for (let s = 0; s < strikes; s += 1) a.issueStrike(id);
  return id;
};
const market = (createApp: (o?: Record<string, unknown>) => unknown, ...dates: string[]): App => {
  const a = app(createApp);
  for (const d of dates.length === 0 ? [SAT] : dates) a.openDay(d, LAYOUT);
  return a;
};

export const cases: TestCase[] = [
  {
    name: 'a licence shows the inspection score, the strikes and the status',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const full = vendor(a, 'Green Acres', 91);
      assert.deepEqual(a.licence(full), { vendorId: full, tradingName: 'Green Acres', inspectionScore: 91, strikes: 0, status: 'full', lastTraded: null });
      assert.equal(a.licence(vendor(a, 'Honey Hill', 60))?.status, 'basic');
      assert.equal(a.licence(vendor(a, 'New Leaf', null))?.status, 'basic');
      assert.equal(a.licence(vendor(a, 'Late Again', 95, 3))?.status, 'suspended');
      assert.throws(() => a.recordInspection(full, 101), /inspection score/);
    },
  },
  {
    name: 'a pitch is booked at its daily fee, the plan shows it and a check-in is kept on the licence',
    kind: 'regression',
    run: (createApp) => {
      const a = market(createApp);
      const v = vendor(a, 'Green Acres', 91);
      const r = a.book(SAT, 'H1', v);
      assert.deepEqual([r.pitch, r.fee], ['H1', 40]);
      assert.equal(a.book(SAT, 'O1', vendor(a, 'Honey Hill', 60)).fee, 25);
      a.checkIn(SAT, v);
      assert.equal(a.licence(v)?.lastTraded, SAT);
      assert.deepEqual(a.pitchPlan(SAT), ['H1 Green Acres: checked-in', 'O1 Honey Hill: expected']);
    },
  },
  {
    name: 'bad bookings and reports are refused',
    kind: 'regression',
    run: (createApp) => {
      const a = market(createApp);
      const v = vendor(a, 'Green Acres', 91);
      const w = vendor(a, 'Honey Hill', 91);
      assert.throws(() => a.book(SAT, 'O1', 'V999'), /no vendor/);
      assert.throws(() => a.book('2026-11-08', 'O1', v), /no market day/);
      assert.throws(() => a.book(SAT, 'X9', v), /no pitch/);
      a.book(SAT, 'O1', v);
      assert.throws(() => a.book(SAT, 'O1', w), /taken/);
      assert.throws(() => a.book(SAT, 'O2', v), /already has a pitch/);
      assert.throws(() => a.reportNoShow(SAT, 'O2'), /no booking/);
      a.checkIn(SAT, v);
      assert.throws(() => a.reportNoShow(SAT, 'O1'), /already checked in/);
      a.book(SAT, 'O2', w);
      a.reportNoShow(SAT, 'O2');
      assert.throws(() => a.reportNoShow(SAT, 'O2'), /already reported/);
      assert.throws(() => a.openDay(SAT, LAYOUT), /already open/);
    },
  },
  {
    name: 'hall pitches need a full licence; basic licences book open-air pitches',
    kind: 'feature',
    step: 'pitch-licences',
    run: (createApp) => {
      const a = market(createApp);
      const basic = vendor(a, 'Honey Hill', 60);
      const unrated = vendor(a, 'New Leaf', null);
      assert.throws(() => a.book(SAT, 'H1', basic), /needs a full licence/);
      assert.throws(() => a.book(SAT, 'H2', unrated), /needs a full licence/);
      assert.equal(a.book(SAT, 'O1', basic).fee, 25);
      assert.equal(a.book(SAT, 'H1', vendor(a, 'Green Acres', 91)).fee, 40);
    },
  },
  {
    name: 'a suspended vendor cannot book any pitch and the pitch stays free',
    kind: 'feature',
    step: 'pitch-licences',
    run: (createApp) => {
      const a = market(createApp);
      const late = vendor(a, 'Late Again', 95, 3);
      assert.throws(() => a.book(SAT, 'O1', late), /suspended/);
      assert.throws(() => a.book(SAT, 'H1', late), /suspended/);
      assert.deepEqual(a.pitchPlan(SAT), []);
      assert.equal(a.book(SAT, 'O1', vendor(a, 'Honey Hill', 60)).pitch, 'O1');
    },
  },
  {
    name: 'a full licence starts at an inspection score of 75, on the licence and at booking',
    kind: 'feature',
    step: 'full-licence-score',
    run: (createApp) => {
      const a = market(createApp);
      const at = vendor(a, 'Seventy Five', 75);
      assert.equal(a.licence(at)?.status, 'full');
      assert.equal(a.book(SAT, 'H1', at).pitch, 'H1');
      const below = vendor(a, 'Seventy Four', 74);
      assert.equal(a.licence(below)?.status, 'basic');
      assert.throws(() => a.book(SAT, 'H2', below), /needs a full licence/);
    },
  },
  {
    name: 'a reported no-show is a strike on the licence at once; a vendor who checked in gets none',
    kind: 'feature',
    step: 'no-show-strikes',
    run: (createApp) => {
      const a = market(createApp);
      const absent = vendor(a, 'Honey Hill', 60);
      const present = vendor(a, 'Green Acres', 91);
      a.book(SAT, 'O1', absent);
      a.book(SAT, 'H1', present);
      a.checkIn(SAT, present);
      a.reportNoShow(SAT, 'O1');
      assert.equal(a.licence(absent)?.strikes, 1);
      assert.equal(a.licence(present)?.strikes, 0);
      assert.equal(a.licence(absent)?.status, 'basic');
    },
  },
  {
    name: 'the third no-show suspends the vendor from the next booking on',
    kind: 'feature',
    step: 'no-show-strikes',
    run: (createApp) => {
      const days = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'];
      const a = market(createApp, ...days);
      const v = vendor(a, 'Late Again', 91, 1);
      a.book(days[0]!, 'H1', v);
      a.reportNoShow(days[0]!, 'H1');
      assert.equal(a.licence(v)?.strikes, 2);
      a.book(days[1]!, 'H1', v);
      a.reportNoShow(days[1]!, 'H1');
      assert.equal(a.licence(v)?.status, 'suspended');
      assert.throws(() => a.book(days[2]!, 'O1', v), /suspended/);
    },
  },
];
