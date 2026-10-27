/**
 * f26 behaviour tests, black-box through `createApp`. Every case must pass on the clean and the trap end state; every
 * feature case must fail on the seed (each one first checks that the new operation exists).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Brewery {
  receiveLot(ingredient: string, kg: number, bestBefore: string): string;
  writeOff(lotId: string, kg: number): void;
  planBatch(beer: string, fermentationDays: number): string;
  lotStock(lotId: string): number;
  batchStatus(batchId: string): string;
  receivingLog(): string[];
  brew(batchId: string, uses: { lotId: string; kg: number }[]): unknown;
  bottle(batchId: string): unknown;
  lotUsage(lotId: string): { batchId: string; kg: number }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;

function open(createApp: Factory, start = '2026-10-21'): { b: Brewery; goTo: (day: string) => void } {
  let day = start;
  const b = createApp({ today: () => day }) as Brewery;
  return { b, goTo: (d) => { day = d; } };
}

function stocked(b: Brewery): { malt: string; hops: string; ale: string } {
  const malt = b.receiveLot('Maris Otter', 25, '2027-03-31');
  const hops = b.receiveLot('Cascade', 3.5, '2026-12-31');
  const ale = b.planBatch('Pale Ale', 14);
  return { malt, hops, ale };
}

const requires = (b: Brewery, op: keyof Brewery): void => assert.equal(typeof b[op], 'function', `${op} is missing`);

export const cases: TestCase[] = [
  {
    name: 'a received lot holds its kilos and is written in the goods-in book',
    kind: 'regression',
    run: (createApp) => {
      const { b } = open(createApp);
      const lot = b.receiveLot('Maris Otter', 25, '2027-03-31');
      assert.equal(b.lotStock(lot), 25);
      assert.ok(b.receivingLog().some((l) => l.includes(lot) && l.includes('Maris Otter')));
    },
  },
  {
    name: 'a delivery already past its best-before or of zero kg is refused',
    kind: 'regression',
    run: (createApp) => {
      const { b } = open(createApp);
      assert.throws(() => b.receiveLot('Cascade', 2, '2026-10-20'), /past its best-before date 2026-10-20/);
      assert.throws(() => b.receiveLot('Cascade', 0, '2027-01-01'), /more than zero/);
      assert.equal(b.receivingLog().length, 0);
    },
  },
  {
    name: 'a write-off takes kilos out and refuses to go below zero',
    kind: 'regression',
    run: (createApp) => {
      const { b } = open(createApp);
      const lot = b.receiveLot('Cascade', 3.5, '2026-12-31');
      b.writeOff(lot, 1.25);
      assert.equal(b.lotStock(lot), 2.25);
      assert.throws(() => b.writeOff(lot, 3), /not enough in lot L-0001: 2\.25 kg left/);
      assert.throws(() => b.writeOff('L-9999', 1), /no lot L-9999/);
      assert.equal(b.lotStock(lot), 2.25);
    },
  },
  {
    name: 'a planned batch starts as planned',
    kind: 'regression',
    run: (createApp) => {
      const { b } = open(createApp);
      const ale = b.planBatch('Pale Ale', 14);
      assert.equal(b.batchStatus(ale), 'planned');
      assert.throws(() => b.planBatch('Stout', 0), /at least 1/);
    },
  },
  {
    name: 'brewing takes the kilos out of every lot and the batch ferments',
    kind: 'feature',
    step: 'brew',
    run: (createApp) => {
      const { b } = open(createApp);
      const { malt, hops, ale } = stocked(b);
      b.brew(ale, [{ lotId: malt, kg: 20 }, { lotId: hops, kg: 1.5 }]);
      assert.equal(b.lotStock(malt), 5);
      assert.equal(b.lotStock(hops), 2);
      assert.equal(b.batchStatus(ale), 'fermenting');
    },
  },
  {
    name: 'a brew asking more than a lot holds is refused and nothing changes',
    kind: 'feature',
    step: 'brew',
    run: (createApp) => {
      const { b } = open(createApp);
      const { malt, hops, ale } = stocked(b);
      requires(b, 'brew');
      assert.throws(() => b.brew(ale, [{ lotId: malt, kg: 20 }, { lotId: hops, kg: 4 }]), /not enough in lot L-0002: 3\.50 kg left/);
      assert.equal(b.lotStock(malt), 25);
      assert.equal(b.lotStock(hops), 3.5);
      assert.equal(b.batchStatus(ale), 'planned');
    },
  },
  {
    name: 'a lot past its best-before is refused, but usable on the day itself',
    kind: 'feature',
    step: 'brew',
    run: (createApp) => {
      const { b, goTo } = open(createApp, '2026-10-19');
      const malt = b.receiveLot('Maris Otter', 25, '2027-03-31');
      const yeast = b.receiveLot('US-05', 1, '2026-10-20');
      const ale = b.planBatch('Pale Ale', 14);
      requires(b, 'brew');
      goTo('2026-10-21');
      assert.throws(() => b.brew(ale, [{ lotId: malt, kg: 10 }, { lotId: yeast, kg: 0.5 }]), /lot L-0002 is past its best-before date 2026-10-20/);
      assert.equal(b.lotStock(malt), 25);
      assert.equal(b.batchStatus(ale), 'planned');
      const other = open(createApp, '2026-10-20').b;
      const m2 = other.receiveLot('Maris Otter', 25, '2027-03-31');
      const y2 = other.receiveLot('US-05', 1, '2026-10-20');
      const a2 = other.planBatch('Pale Ale', 14);
      other.brew(a2, [{ lotId: m2, kg: 10 }, { lotId: y2, kg: 0.5 }]);
      assert.equal(other.lotStock(y2), 0.5);
    },
  },
  {
    name: 'unknown, repeated, empty and second brews are refused and nothing changes',
    kind: 'feature',
    step: 'brew',
    run: (createApp) => {
      const { b } = open(createApp);
      const { malt, hops, ale } = stocked(b);
      requires(b, 'brew');
      assert.throws(() => b.brew('B-9999', [{ lotId: malt, kg: 1 }]), /no batch B-9999/);
      assert.throws(() => b.brew(ale, [{ lotId: malt, kg: 1 }, { lotId: 'L-9999', kg: 1 }]), /no lot L-9999/);
      assert.throws(() => b.brew(ale, [{ lotId: hops, kg: 1 }, { lotId: hops, kg: 1 }]));
      assert.throws(() => b.brew(ale, []));
      assert.equal(b.lotStock(malt), 25);
      assert.equal(b.lotStock(hops), 3.5);
      assert.equal(b.batchStatus(ale), 'planned');
      b.brew(ale, [{ lotId: malt, kg: 5 }]);
      assert.throws(() => b.brew(ale, [{ lotId: malt, kg: 5 }]), /batch B-0001 is already brewed/);
      assert.equal(b.lotStock(malt), 20);
    },
  },
  {
    name: 'a batch is bottled only once its fermentation days have passed',
    kind: 'feature',
    step: 'bottling',
    run: (createApp) => {
      const { b, goTo } = open(createApp);
      const { malt, ale } = stocked(b);
      requires(b, 'bottle');
      b.brew(ale, [{ lotId: malt, kg: 20 }]);
      goTo('2026-11-03');
      assert.throws(() => b.bottle(ale), /batch B-0001 cannot be bottled before 2026-11-04/);
      assert.equal(b.batchStatus(ale), 'fermenting');
      goTo('2026-11-04');
      b.bottle(ale);
      assert.equal(b.batchStatus(ale), 'bottled');
    },
  },
  {
    name: 'bottling a batch that is not fermenting, or unknown, is refused',
    kind: 'feature',
    step: 'bottling',
    run: (createApp) => {
      const { b, goTo } = open(createApp);
      const { malt, ale } = stocked(b);
      const stout = b.planBatch('Stout', 3);
      requires(b, 'bottle');
      assert.throws(() => b.bottle(ale), /batch B-0001 is not fermenting/);
      assert.throws(() => b.bottle('B-9999'), /no batch B-9999/);
      b.brew(stout, [{ lotId: malt, kg: 8 }]);
      goTo('2026-10-24');
      b.bottle(stout);
      assert.throws(() => b.bottle(stout), /batch B-0002 is not fermenting/);
      assert.equal(b.batchStatus(ale), 'planned');
      assert.equal(b.batchStatus(stout), 'bottled');
    },
  },
  {
    name: 'lot usage lists the brews that used a lot, newest first, without write-offs',
    kind: 'feature',
    step: 'lot-usage',
    run: (createApp) => {
      const { b } = open(createApp);
      const { malt, hops, ale } = stocked(b);
      const stout = b.planBatch('Stout', 21);
      b.brew(ale, [{ lotId: malt, kg: 10 }, { lotId: hops, kg: 1 }]);
      b.writeOff(malt, 2);
      b.brew(stout, [{ lotId: malt, kg: 7.5 }]);
      assert.deepEqual(b.lotUsage(malt), [{ batchId: stout, kg: 7.5 }, { batchId: ale, kg: 10 }]);
      assert.deepEqual(b.lotUsage(hops), [{ batchId: ale, kg: 1 }]);
      const spare = b.receiveLot('Crystal 60', 5, '2027-01-31');
      assert.deepEqual(b.lotUsage(spare), []);
      assert.throws(() => b.lotUsage('L-9999'), /no lot L-9999/);
    },
  },
];
