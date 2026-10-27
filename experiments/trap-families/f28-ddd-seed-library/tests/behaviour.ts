/**
 * F28 behaviour tests, black-box through `createApp`. Every case passes on the clean and on the trap end state; every
 * feature case fails on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Lot {
  number: string;
  variety: string;
  garden: string;
  grams: number;
  germination: number;
  intake: string;
  cameFrom?: string | null;
}
interface Library {
  donate(donor: string, variety: string, grams: number, germination: number, garden: string): string;
  take(lot: string, grams: number): void;
  lot(lot: string): Lot;
  lotsAt(garden: string): string[];
  thanks(): string[];
  share(lot: string, garden: string, grams: number): string;
  lotLog(lot: string): { entry: string; grams: number; otherLot: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
function library(createApp: Factory, start = '2026-09-01'): { lib: Library; on: (day: string) => void } {
  let day = start;
  const lib = createApp({ today: () => day }) as Library;
  return { lib, on: (d) => { day = d; } };
}
/** A healthy lot donated on 2026-09-01 at Northside, then the calendar moved to 2026-10-21. */
function healthyLot(createApp: Factory): { lib: Library; on: (day: string) => void; lot: string } {
  const h = library(createApp);
  const lot = h.lib.donate('Rosa', 'Cherokee Purple', 120, 85, 'Northside');
  h.on('2026-10-21');
  return { ...h, lot };
}
const requireShare = (lib: Library): void => assert.equal(typeof lib.share, 'function', 'share is not offered');

export const cases: TestCase[] = [
  {
    name: 'a donation becomes a lot at its garden',
    kind: 'regression',
    run: (createApp) => {
      const { lib } = library(createApp);
      const lot = lib.donate('Rosa', 'Cherokee Purple', 120, 85, 'Northside');
      const view = lib.lot(lot);
      assert.equal(view.variety, 'Cherokee Purple');
      assert.equal(view.garden, 'Northside');
      assert.equal(view.grams, 120);
      assert.equal(view.germination, 85);
      assert.equal(view.intake, '2026-09-01');
      assert.deepEqual(lib.lotsAt('Northside'), [lot]);
    },
  },
  {
    name: 'taking seed lowers the lot and taking too much is refused',
    kind: 'regression',
    run: (createApp) => {
      const { lib } = library(createApp);
      const lot = lib.donate('Rosa', 'Cherokee Purple', 120, 85, 'Northside');
      lib.take(lot, 20);
      assert.equal(lib.lot(lot).grams, 100);
      assert.throws(() => lib.take(lot, 101), /not enough seed: L-0001 holds 100 g/);
      assert.equal(lib.lot(lot).grams, 100);
    },
  },
  {
    name: 'a donation pins a thank-you note',
    kind: 'regression',
    run: (createApp) => {
      const { lib } = library(createApp);
      const lot = lib.donate('Rosa', 'Cherokee Purple', 120, 85, 'Northside');
      assert.deepEqual(lib.thanks(), [`Thank you, Rosa, for 120 g of Cherokee Purple (${lot}).`]);
    },
  },
  {
    name: 'sharing splits a lot: the other garden gets a new lot and the original shrinks',
    kind: 'feature',
    step: 'sharing',
    run: (createApp) => {
      const { lib, lot } = healthyLot(createApp);
      requireShare(lib);
      const portion = lib.share(lot, 'Riverside', 45);
      assert.notEqual(portion, lot);
      assert.equal(lib.lot(lot).grams, 75);
      assert.equal(lib.lot(lot).cameFrom, null);
      const got = lib.lot(portion);
      assert.equal(got.garden, 'Riverside');
      assert.equal(got.grams, 45);
      assert.equal(got.variety, 'Cherokee Purple');
      assert.equal(got.germination, 85);
      assert.equal(got.intake, '2026-10-21');
      assert.equal(got.cameFrom, lot);
      assert.deepEqual(lib.lotsAt('Riverside'), [portion]);
      assert.deepEqual(lib.lotsAt('Northside'), [lot]);
      assert.equal(lib.thanks().length, 1);
    },
  },
  {
    name: 'sharing more than the lot holds is refused and nothing changes',
    kind: 'feature',
    step: 'sharing',
    run: (createApp) => {
      const { lib, lot } = healthyLot(createApp);
      requireShare(lib);
      assert.throws(() => lib.share(lot, 'Riverside', 121), /not enough seed: L-0001 holds 120 g/);
      assert.equal(lib.lot(lot).grams, 120);
      assert.deepEqual(lib.lotsAt('Riverside'), []);
    },
  },
  {
    name: 'sharing to the same garden, from an unknown lot or of no seed is refused',
    kind: 'feature',
    step: 'sharing',
    run: (createApp) => {
      const { lib, lot } = healthyLot(createApp);
      requireShare(lib);
      assert.throws(() => lib.share(lot, 'Northside', 10), /already/);
      assert.throws(() => lib.share('L-9999', 'Riverside', 10), /no lot L-9999/);
      assert.throws(() => lib.share(lot, 'Riverside', 0));
      assert.equal(lib.lot(lot).grams, 120);
      assert.deepEqual(lib.lotsAt('Riverside'), []);
      assert.deepEqual(lib.lotsAt('Northside'), [lot]);
    },
  },
  {
    name: 'seed in its first 30 days at a garden cannot be shared',
    kind: 'feature',
    step: 'plant-health',
    run: (createApp) => {
      const { lib, on } = library(createApp, '2026-10-01');
      const fresh = lib.donate('Ivo', 'Painted Mountain', 200, 90, 'Northside');
      on('2026-10-30');
      requireShare(lib);
      assert.throws(() => lib.share(fresh, 'Riverside', 50), /lot L-0001 is in quarantine until 2026-10-31/);
      assert.equal(lib.lot(fresh).grams, 200);
      on('2026-10-31');
      const portion = lib.share(fresh, 'Riverside', 50);
      assert.throws(() => lib.share(portion, 'Hillcrest', 10), new RegExp(`lot ${portion} is in quarantine until 2026-11-30`));
      assert.equal(lib.lot(portion).grams, 50);
      assert.deepEqual(lib.lotsAt('Hillcrest'), []);
      on('2026-11-30');
      lib.share(portion, 'Hillcrest', 10);
      assert.equal(lib.lot(portion).grams, 40);
    },
  },
  {
    name: 'seed that germinates below 70% cannot be shared',
    kind: 'feature',
    step: 'plant-health',
    run: (createApp) => {
      const { lib, on } = library(createApp);
      const weak = lib.donate('Ivo', 'Moon and Stars', 80, 69, 'Northside');
      const fair = lib.donate('Ivo', 'Moon and Stars', 80, 70, 'Northside');
      on('2026-10-21');
      requireShare(lib);
      assert.throws(() => lib.share(weak, 'Riverside', 10), /germination 69% is below 70%/);
      assert.equal(lib.lot(weak).grams, 80);
      lib.take(weak, 10);
      lib.share(fair, 'Riverside', 10);
      assert.equal(lib.lotsAt('Riverside').length, 1);
    },
  },
  {
    name: 'a lot log lists what happened to the lot, oldest first',
    kind: 'feature',
    step: 'lot-log',
    run: (createApp) => {
      const { lib, lot } = healthyLot(createApp);
      lib.take(lot, 20);
      const portion = lib.share(lot, 'Riverside', 30);
      assert.deepEqual(lib.lotLog(lot), [
        { entry: 'donated', grams: 120, otherLot: null },
        { entry: 'taken', grams: 20, otherLot: null },
        { entry: 'shared-out', grams: 30, otherLot: portion },
      ]);
      assert.deepEqual(lib.lotLog(portion), [{ entry: 'shared-in', grams: 30, otherLot: lot }]);
    },
  },
];
