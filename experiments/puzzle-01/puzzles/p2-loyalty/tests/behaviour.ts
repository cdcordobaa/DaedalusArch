/**
 * P2 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../tools/run-tests';

interface App {
  enrol(name: string): string;
  awardPoints(memberId: string, points: number): void;
  memberCard(memberId: string): { memberId: string; name: string; points: number; tier: string } | undefined;
  placeOrder(memberId: string | null, lines: { sku: string; quantity: number; unitPrice: number }[]): { orderId: string; total: number; discount?: number };
  receipts(): string[];
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const memberWith = (a: App, points: number): string => {
  const id = a.enrol('Bea');
  if (points > 0) a.awardPoints(id, points);
  return id;
};
const hundred = [{ sku: 'TEA', quantity: 4, unitPrice: 25 }];

export const cases: TestCase[] = [
  {
    name: 'a member card shows points and tier',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 600);
      assert.deepEqual(a.memberCard(m), { memberId: m, name: 'Bea', points: 600, tier: 'silver' });
      assert.equal(a.memberCard(memberWith(a, 0))?.tier, 'standard');
    },
  },
  {
    name: 'an order is placed and a receipt is sent',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const r = a.placeOrder(null, [{ sku: 'TEA', quantity: 2, unitPrice: 3.5 }]);
      assert.equal(r.total, 7);
      assert.ok(a.receipts().some((t) => t.includes(r.orderId) && t.includes('7.00')));
    },
  },
  {
    name: 'an order with a bad line or an unknown member is refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      assert.throws(() => a.placeOrder(null, [{ sku: 'TEA', quantity: 0, unitPrice: 3 }]), /quantity/);
      assert.throws(() => a.placeOrder('M-9999', hundred), /no member/);
    },
  },
  {
    name: 'gold members get 10% off and silver 5%, shown separately',
    kind: 'feature',
    step: 'tier-discount',
    run: (createApp) => {
      const a = app(createApp);
      const gold = a.placeOrder(memberWith(a, 2400), hundred);
      assert.deepEqual([gold.total, gold.discount], [90, 10]);
      const silver = a.placeOrder(memberWith(a, 700), hundred);
      assert.deepEqual([silver.total, silver.discount], [95, 5]);
    },
  },
  {
    name: 'standard members and guests pay the full price',
    kind: 'feature',
    step: 'tier-discount',
    run: (createApp) => {
      const a = app(createApp);
      const standard = a.placeOrder(memberWith(a, 100), hundred);
      assert.deepEqual([standard.total, standard.discount], [100, 0]);
      const guest = a.placeOrder(null, hundred);
      assert.deepEqual([guest.total, guest.discount], [100, 0]);
    },
  },
  {
    name: 'gold starts at 1,500 points, on the card and at the till',
    kind: 'feature',
    step: 'gold-threshold',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 1500);
      assert.equal(a.memberCard(m)?.tier, 'gold');
      assert.equal(a.placeOrder(m, hundred).discount, 10);
      const s = memberWith(a, 1499);
      assert.equal(a.memberCard(s)?.tier, 'silver');
      assert.equal(a.placeOrder(s, hundred).discount, 5);
    },
  },
  {
    name: 'a member earns one point per whole unit paid after discount',
    kind: 'feature',
    step: 'points-on-orders',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 0);
      a.placeOrder(m, [{ sku: 'JAM', quantity: 3, unitPrice: 41.15 }]);
      assert.equal(a.memberCard(m)?.points, 123);
      const g = memberWith(a, 1500);
      a.placeOrder(g, hundred);
      assert.equal(a.memberCard(g)?.points, 1590);
    },
  },
  {
    name: 'earned points count for the next order and guests earn nothing',
    kind: 'feature',
    step: 'points-on-orders',
    run: (createApp) => {
      const a = app(createApp);
      const m = memberWith(a, 450);
      a.placeOrder(m, [{ sku: 'TEA', quantity: 2, unitPrice: 25 }]);
      assert.equal(a.memberCard(m)?.tier, 'silver');
      assert.equal(a.placeOrder(m, hundred).discount, 5);
      assert.doesNotThrow(() => a.placeOrder(null, hundred));
    },
  },
];
