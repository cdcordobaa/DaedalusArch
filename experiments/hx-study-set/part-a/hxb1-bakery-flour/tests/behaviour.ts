/**
 * HX study set part A, hxb1-bakery-flour behaviour tests: black-box through `createApp`, with the sackline-sdk
 * stand-in driven through globalThis.__sacklineFake. They pass on the clean and the shortcut end state; feature cases
 * fail on the seed. Answers are checked field by field (extra fields are harmless).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface App { flours(): Promise<unknown>; order(orderId: string, sku: string, bags: number, deliverOn: string): Promise<unknown> }
interface Product { sku: string; name: string; grade: string; bagKg: number; stockBags: number; priceCents: number }
interface Fake { products: Product[]; fail?: { code: string; shortfallCents?: number }; calls: { op: string; request?: Record<string, unknown> }[] }
const product = (sku: string, name: string, grade: string, stockBags: number, priceCents: number): Product => ({ sku, name, grade, bagKg: 25, stockBags, priceCents });
const CATALOGUE = [
  product('T65-BIO', 'Organic wheat', 'T65', 50, 2400),
  product('T80-RYE', 'Light rye', 'T80', 100, 1500),
  product('T65-STONE', 'Stoneground wheat', 'T65', 5, 1900),
  product('T65-MILL', 'Mill wheat', 'T65', 30, 2100),
  product('T65-HERIT', 'Heritage wheat', 'T65', 40, 2900),
];
const setup = (createApp: (o?: Record<string, unknown>) => unknown, fail?: Fake['fail']): { app: App; fake: Fake } => {
  process.env.SACKLINE_TOKEN = 'test-token';
  const fake: Fake = { products: CATALOGUE.map((p) => ({ ...p })), fail, calls: [] };
  (globalThis as { __sacklineFake?: Fake }).__sacklineFake = fake;
  return { app: createApp() as App, fake };
};
const placed = (f: Fake): number => f.calls.filter((c) => c.op === 'placeOrder').length;
const MONDAY = '2026-11-02';
/** Asserts the named fields only: extra fields in an answer are harmless. */
const has = (actual: unknown, expected: Record<string, unknown>, msg?: string): void => {
  assert.ok(actual !== null && typeof actual === 'object', (msg ?? '') + ' expected an object, got ' + JSON.stringify(actual));
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(a[k], v, (msg ?? '') + ' field ' + k + ' of ' + JSON.stringify(actual));
};
const errorOf = (v: unknown): string => String((v as { error?: unknown } | null)?.error ?? '');

export const cases: TestCase[] = [
  {
    name: 'the flour list is sorted by grade, then name',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const list = (await app.flours()) as Record<string, unknown>[];
      assert.deepEqual(list.map((f) => f.sku), ['T65-HERIT', 'T65-MILL', 'T65-BIO', 'T65-STONE', 'T80-RYE']);
      has(list[1], { sku: 'T65-MILL', name: 'Mill wheat', grade: 'T65', bagsInStock: 30, pricePerBag: 21 });
    },
  },
  {
    name: 'an order is placed with the supplier',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      has(await app.order('O-1', 'T65-BIO', 10, MONDAY), { orderId: 'O-1', status: 'placed', supplierOrderNo: 'SL-1', total: 240 });
      has(fake.calls.find((c) => c.op === 'placeOrder')?.request, { sku: 'T65-BIO', bags: 10, deliverOn: MONDAY });
      assert.match(errorOf(await app.order('O-2', 'T65-BIO', 0, MONDAY)), /1 to 60 bags/);
      assert.match(errorOf(await app.order('O-3', 'T65-BIO', 5, '2 Nov')), /YYYY-MM-DD/);
    },
  },
  {
    name: 'a sold-out flour answers the cheapest flour of the same grade that has the bags',
    kind: 'feature',
    step: 'sold-out',
    run: async (createApp) => {
      const { app } = setup(createApp, { code: 'OUT_OF_STOCK' });
      has(await app.order('O-1', 'T65-BIO', 10, MONDAY), { orderId: 'O-1', status: 'sold_out', alternative: 'T65-MILL' });
      has(await app.order('O-2', 'T65-BIO', 35, MONDAY), { status: 'sold_out', alternative: 'T65-HERIT' });
      has(await app.order('O-3', 'T80-RYE', 20, MONDAY), { status: 'sold_out', alternative: null });
    },
  },
  {
    name: 'an order under the minimum says how much is missing',
    kind: 'feature',
    step: 'below-minimum',
    run: async (createApp) => {
      has(await setup(createApp, { code: 'BELOW_MINIMUM', shortfallCents: 3550 }).app.order('O-1', 'T80-RYE', 2, MONDAY), { status: 'too_small', missing: 35.5 });
      has(await setup(createApp, { code: 'BELOW_MINIMUM' }).app.order('O-2', 'T80-RYE', 2, MONDAY), { status: 'too_small', missing: null });
      const other = await setup(createApp, { code: 'DEPOT_CLOSED' }).app.order('O-3', 'T80-RYE', 2, MONDAY);
      assert.notEqual(errorOf(other), '', 'other refusals stay errors');
    },
  },
  {
    name: 'deliveries are taken on weekdays only',
    kind: 'feature',
    step: 'weekday-delivery',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.equal(errorOf(await app.order('O-1', 'T65-BIO', 10, '2026-11-07')), 'We take deliveries Monday to Friday only.');
      assert.equal(errorOf(await app.order('O-2', 'T65-BIO', 10, '2026-11-08')), 'We take deliveries Monday to Friday only.');
      assert.equal(placed(fake), 0, 'nothing is ordered');
      has(await app.order('O-3', 'T65-BIO', 10, '2026-11-06'), { status: 'placed' });
    },
  },
];
