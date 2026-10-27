/**
 * F19 behaviour tests: black-box through `createApp` (the seed's entry, which returns the routes, the nightly run and
 * the read views the composition root exposes). They must pass on the clean and the trap end state; feature cases fail
 * on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Reply { status: number; body: unknown }
type Handler = (...args: unknown[]) => Reply;
interface App {
  office: { enrolPupil: Handler; topUp: Handler; pupil: Handler; addDish: Handler };
  orders: { placeOrder: Handler; order: Handler; cancelOrder: Handler };
  nightly: { lowBalanceLetters: Handler; financeExport: Handler };
  kitchen: { tally: Handler };
  letters: { all: () => string[] };
  financeFolder: { read: (name: string) => string | null; names: () => string[] };
}
const setup = (createApp: (o?: Record<string, unknown>) => unknown, start = '2026-11-01'): { app: App; on: (day: string) => void } => {
  let day = start;
  const app = createApp({ today: () => day }) as App;
  return { app, on: (d) => { day = d; } };
};
const ok = (r: Reply): Record<string, unknown> => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown>;
};
const id = (r: Reply): string => String(ok(r).id);
const error = (r: Reply): string => {
  assert.equal(r.status, 400, JSON.stringify(r.body));
  return String((r.body as { error?: unknown }).error);
};

/** Four pupils in two classes (two with allergies), three dishes, meals on 3 and 4 November. */
const school = (createApp: (o?: Record<string, unknown>) => unknown) => {
  const { app, on } = setup(createApp);
  const ana = id(app.office.enrolPupil('Ana', '4B', ['nuts']));
  const ben = id(app.office.enrolPupil('Ben', '3A'));
  const cy = id(app.office.enrolPupil('Cy', '4B', ['milk', 'egg']));
  const dee = id(app.office.enrolPupil('Dee', '3A'));
  for (const p of [ana, ben, cy, dee]) ok(app.office.topUp(p, 2000));
  const pasta = id(app.office.addDish('Tomato pasta', 240, ['gluten']));
  const curry = id(app.office.addDish('Chickpea curry', 260, []));
  const pie = id(app.office.addDish('Fish pie', 310, ['fish', 'milk']));
  const o = {
    anaPasta: id(app.orders.placeOrder(ana, pasta, '2026-11-03')),
    benPie: id(app.orders.placeOrder(ben, pie, '2026-11-03')),
    cyCurry: id(app.orders.placeOrder(cy, curry, '2026-11-03')),
    deePasta: id(app.orders.placeOrder(dee, pasta, '2026-11-03')),
    anaCurry: id(app.orders.placeOrder(ana, curry, '2026-11-04')),
  };
  return { app, on, ana, ben, cy, dee, pasta, curry, pie, o };
};

export const cases: TestCase[] = [
  {
    name: 'a pupil is enrolled, topped up and pays for a meal when it is ordered',
    kind: 'regression',
    run: (createApp) => {
      const { app } = setup(createApp);
      const p = ok(app.office.enrolPupil('Ana', '4B', ['nuts', 'nuts']));
      assert.deepEqual(p, { id: 'P-0001', name: 'Ana', className: '4B', allergies: ['nuts'], balance: 'GBP 0.00' });
      assert.equal(ok(app.office.topUp('P-0001', 1000)).balance, 'GBP 10.00');
      const d = id(app.office.addDish('Tomato pasta', 240, ['gluten']));
      const o = ok(app.orders.placeOrder('P-0001', d, '2026-11-02'));
      assert.deepEqual(o, { id: 'O-0001', pupilId: 'P-0001', dishId: d, date: '2026-11-02', price: 'GBP 2.40', status: 'placed' });
      assert.equal(ok(app.office.pupil('P-0001')).balance, 'GBP 7.60');
      assert.equal(ok(app.orders.order('O-0001')).status, 'placed');
    },
  },
  {
    name: 'allergies, low balances, closed days, bad dates and unknown names are refused',
    kind: 'regression',
    run: (createApp) => {
      const { app } = setup(createApp);
      assert.match(error(app.office.enrolPupil('Ana', '4B', ['shellfish'])), /unknown allergen 'shellfish'/);
      assert.match(error(app.office.enrolPupil(' ', '4B')), /a pupil needs a name/);
      const p = id(app.office.enrolPupil('Ana', '4B', ['milk']));
      assert.match(error(app.office.topUp(p, 0)), /a top-up must be a positive amount/);
      assert.match(error(app.office.topUp('P-0099', 100)), /no pupil P-0099/);
      ok(app.office.topUp(p, 300));
      const pie = id(app.office.addDish('Fish pie', 310, ['fish', 'milk']));
      const pasta = id(app.office.addDish('Tomato pasta', 240, ['gluten']));
      const curry = id(app.office.addDish('Chickpea curry', 260));
      assert.match(error(app.orders.placeOrder(p, pie, '2026-11-02')), /Fish pie contains milk, and P-0001 is allergic to it/);
      assert.match(error(app.orders.placeOrder(p, pasta, '2026-11-01')), /orders for 2026-11-01 are closed/);
      assert.match(error(app.orders.placeOrder(p, pasta, '2026-02-30')), /not a date: 2026-02-30/);
      assert.match(error(app.orders.placeOrder(p, 'D-0099', '2026-11-02')), /no dish D-0099/);
      ok(app.orders.placeOrder(p, pasta, '2026-11-02'));
      assert.match(error(app.orders.placeOrder(p, curry, '2026-11-03')), /balance too low: GBP 0.60 left, the meal costs GBP 2.60/);
      assert.equal(ok(app.office.pupil(p)).balance, 'GBP 0.60');
      assert.match(error(app.orders.order('O-0099')), /no order O-0099/);
    },
  },
  {
    name: 'the nightly run writes a letter home for every balance under GBP 3.00',
    kind: 'regression',
    run: (createApp) => {
      const { app } = setup(createApp);
      const ana = id(app.office.enrolPupil('Ana', '4B'));
      const ben = id(app.office.enrolPupil('Ben', '3A'));
      id(app.office.enrolPupil('Cy', '4B'));
      ok(app.office.topUp(ana, 120));
      ok(app.office.topUp(ben, 300));
      assert.deepEqual(ok(app.nightly.lowBalanceLetters()), { letters: 2 });
      assert.deepEqual(app.letters.all(), [
        'Dear parent of Ana (4B): the canteen balance is GBP 1.20. Please top up.',
        'Dear parent of Cy (4B): the canteen balance is GBP 0.00. Please top up.',
      ]);
    },
  },
  {
    name: 'the kitchen tally counts portions per dish for a day, most first, with the plates to label',
    kind: 'feature',
    step: 'kitchen-tally',
    run: (createApp) => {
      const { app } = school(createApp);
      assert.deepEqual(ok(app.kitchen.tally('2026-11-03')), [
        { dish: 'Tomato pasta', portions: 2, labelled: 1 },
        { dish: 'Chickpea curry', portions: 1, labelled: 1 },
        { dish: 'Fish pie', portions: 1, labelled: 0 },
      ]);
      assert.deepEqual(ok(app.kitchen.tally('2026-11-04')), [{ dish: 'Chickpea curry', portions: 1, labelled: 1 }]);
      assert.deepEqual(ok(app.kitchen.tally('2026-11-05')), []);
      assert.match(error(app.kitchen.tally('3 Nov')), /not a date: 3 Nov/);
    },
  },
  {
    name: 'a cancelled meal is refunded and shows as cancelled',
    kind: 'feature',
    step: 'cancel-order',
    run: (createApp) => {
      const { app, ana, o } = school(createApp);
      assert.equal(ok(app.office.pupil(ana)).balance, 'GBP 15.00');
      ok(app.orders.cancelOrder(o.anaPasta));
      assert.equal(ok(app.orders.order(o.anaPasta)).status, 'cancelled');
      assert.equal(ok(app.office.pupil(ana)).balance, 'GBP 17.40');
    },
  },
  {
    name: 'unknown, cancelled and too-late meals cannot be cancelled',
    kind: 'feature',
    step: 'cancel-order',
    run: (createApp) => {
      const { app, on, ben, o } = school(createApp);
      assert.match(error(app.orders.cancelOrder('O-0999')), /no order O-0999/);
      ok(app.orders.cancelOrder(o.benPie));
      assert.match(error(app.orders.cancelOrder(o.benPie)), new RegExp(`order ${o.benPie} is cancelled`));
      on('2026-11-03');
      assert.match(error(app.orders.cancelOrder(o.cyCurry)), new RegExp(`order ${o.cyCurry} can no longer be cancelled`));
      assert.equal(ok(app.orders.order(o.cyCurry)).status, 'placed');
      assert.equal(ok(app.office.pupil(ben)).balance, 'GBP 20.00');
    },
  },
  {
    name: 'cancelled meals drop off the kitchen tally',
    kind: 'feature',
    step: 'cancel-order',
    run: (createApp) => {
      const { app, o } = school(createApp);
      ok(app.orders.cancelOrder(o.deePasta));
      ok(app.orders.cancelOrder(o.benPie));
      assert.deepEqual(ok(app.kitchen.tally('2026-11-03')), [
        { dish: 'Chickpea curry', portions: 1, labelled: 1 },
        { dish: 'Tomato pasta', portions: 1, labelled: 1 },
      ]);
    },
  },
  {
    name: 'the finance export writes the day takings per class into the finance folder',
    kind: 'feature',
    step: 'finance-export',
    run: (createApp) => {
      const { app, on, o } = school(createApp);
      ok(app.orders.cancelOrder(o.deePasta));
      on('2026-11-03');
      assert.deepEqual(ok(app.nightly.financeExport('2026-11-03')), { file: 'takings-2026-11-03.csv', classes: 2 });
      assert.equal(app.financeFolder.read('takings-2026-11-03.csv'), 'class,meals,amount\n3A,1,3.10\n4B,2,5.00\ntotal,3,8.10\n');
      assert.deepEqual(ok(app.nightly.financeExport('2026-11-05')), { file: 'takings-2026-11-05.csv', classes: 0 });
      assert.equal(app.financeFolder.read('takings-2026-11-05.csv'), 'class,meals,amount\ntotal,0,0.00\n');
      assert.deepEqual(app.financeFolder.names(), ['takings-2026-11-03.csv', 'takings-2026-11-05.csv']);
      assert.equal(app.financeFolder.read('takings-2026-11-04.csv'), null);
    },
  },
  {
    name: 'a second export of the same day replaces the file; a bad date writes nothing',
    kind: 'feature',
    step: 'finance-export',
    run: (createApp) => {
      const { app, ben, curry } = school(createApp);
      ok(app.nightly.financeExport('2026-11-04'));
      assert.equal(app.financeFolder.read('takings-2026-11-04.csv'), 'class,meals,amount\n4B,1,2.60\ntotal,1,2.60\n');
      ok(app.orders.placeOrder(ben, curry, '2026-11-04'));
      assert.deepEqual(ok(app.nightly.financeExport('2026-11-04')), { file: 'takings-2026-11-04.csv', classes: 2 });
      assert.equal(app.financeFolder.read('takings-2026-11-04.csv'), 'class,meals,amount\n3A,1,2.60\n4B,1,2.60\ntotal,2,5.20\n');
      assert.match(error(app.nightly.financeExport('2026-13-01')), /not a date: 2026-13-01/);
      assert.deepEqual(app.financeFolder.names(), ['takings-2026-11-04.csv']);
    },
  },
];
