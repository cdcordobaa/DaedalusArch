/**
 * F21 behaviour tests: black-box through `createApp` (the seed's entry, src/config/bootstrap.ts), with the
 * haemalink-sdk stand-in driven through globalThis.__haemalinkFake. They must pass on the clean and the trap end state;
 * feature cases fail on the seed. Answers are compared field by field, so extra fields are allowed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Answer {
  fromStock: number;
  outstanding: number;
  status: string;
  fromSupplier?: number;
  supplierOrder?: string | null;
  holdReason?: string | null;
  holdUntil?: string | null;
  substituted?: number;
  coverOrder?: string | null;
}
interface Input { ward: string; component: string; group: string; units: number; urgent?: boolean }
interface App {
  request(input: Input): Promise<Answer>;
  delivery(orderNumber: string): Promise<{ state: string; at: string }>;
}
interface Line { product: string; abo: string; rhd: string; qty: number }
interface Order { priority: string; lines: Line[] }
type Outcome = { allocate?: number[]; embargo?: { code: string; liftsAt: string }; fail?: number };
interface Fake {
  calls: { op: string; siteCode?: string; request?: Order; orderRef?: string }[];
  submit: (request: Order, n: number) => Outcome;
  consignment: (orderRef: string) => unknown;
}
type Shelf = { component: string; group: string; units: number };

const setup = (createApp: (o?: Record<string, unknown>) => unknown, stock: Shelf[] = [], fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.HAEMALINK_API_KEY = 'test-key';
  process.env.HAEMALINK_SITE = 'ST-MARY-04';
  const f: Fake = { calls: [], submit: () => ({}), consignment: () => ({ orderRef: 'HL-1', stage: 'PICKING', stageAt: '2026-10-27T08:00:00Z' }), ...fake };
  (globalThis as { __haemalinkFake?: Fake }).__haemalinkFake = f;
  return { app: createApp({ stock }) as App, fake: f };
};
const orders = (f: Fake): Order[] => f.calls.filter((c) => c.op === 'submitOrder').map((c) => c.request as Order);
const in1h = (): string => new Date(Date.now() + 3600_000).toISOString();
const embargo = (code: string, liftsAt: string): Outcome => ({ embargo: { code, liftsAt } });
const ask = (group: string, units: number, urgent = false, comp = 'red cells'): Input => ({ ward: 'ICU', component: comp, group, units, urgent });
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const cases: TestCase[] = [
  {
    name: 'a delivery is followed in plain words',
    kind: 'regression',
    run: async (createApp) => {
      const stages: Record<string, unknown> = {
        'HL-1': { orderRef: 'HL-1', stage: 'PICKING', stageAt: '2026-10-27T08:00:00Z' },
        'HL-2': { orderRef: 'HL-2', stage: 'DISPATCHED', stageAt: '2026-10-27T08:20:00Z', courierId: 'C9' },
        'HL-3': { orderRef: 'HL-3', stage: 'DELIVERED', stageAt: '2026-10-27T09:05:00Z' },
      };
      const { app } = setup(createApp, [], { consignment: (ref) => stages[ref] });
      assert.deepEqual(await app.delivery('HL-1'), { state: 'being packed', at: '2026-10-27T08:00:00Z' });
      assert.deepEqual(await app.delivery('HL-2'), { state: 'on the way', at: '2026-10-27T08:20:00Z' });
      assert.deepEqual(await app.delivery('HL-3'), { state: 'delivered', at: '2026-10-27T09:05:00Z' });
    },
  },
  {
    name: 'bad requests are refused in check order, without taking units or asking the supplier',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 5 }]);
      await assert.rejects(app.request({ ward: ' ', component: 'whole blood', group: 'C+', units: 0 }), /ward/);
      await assert.rejects(app.request({ ward: 'ICU', component: 'whole blood', group: 'C+', units: 0 }), /component/);
      await assert.rejects(app.request({ ward: 'ICU', component: 'red cells', group: 'C+', units: 0 }), /group/);
      await assert.rejects(app.request(ask('A+', 0)), /units/);
      await assert.rejects(app.request(ask('A+', 21)), /units/);
      await assert.rejects(app.request(ask('A+', 2.5)), /units/);
      assert.equal(orders(fake).length, 0);
      const a = await app.request(ask('A+', 5));
      assert.deepEqual([a.fromStock, a.outstanding, a.status], [5, 0, 'filled']);
    },
  },
  {
    name: 'the fridge gives units by component and group and is used up',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 3 }, { component: 'platelets', group: 'A+', units: 1 }]);
      const a = await app.request(ask('A+', 2));
      assert.deepEqual([a.fromStock, a.outstanding, a.status], [2, 0, 'filled']);
      const b = await app.request(ask('a+', 1, false, 'Platelets'));
      assert.deepEqual([b.fromStock, b.outstanding, b.status], [1, 0, 'filled']);
      const c = await app.request(ask('A+', 1));
      assert.deepEqual([c.fromStock, c.outstanding, c.status], [1, 0, 'filled']);
      assert.equal(orders(fake).length, 0);
    },
  },
  {
    name: 'the shortfall is ordered from the supplier in one line, emergency priority when urgent',
    kind: 'feature',
    step: 'supplier-orders',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 1 }]);
      const a = await app.request(ask('A+', 4, true));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.outstanding, a.status, a.supplierOrder], [1, 3, 0, 'filled', 'HL-7001']);
      assert.deepEqual(orders(fake)[0], { priority: 'STAT', lines: [{ product: 'RBC', abo: 'A', rhd: 'POS', qty: 3 }] });
      assert.equal(fake.calls[0]?.siteCode, 'ST-MARY-04');
      await app.request(ask('AB-', 2, false, 'plasma'));
      assert.deepEqual(orders(fake)[1], { priority: 'ROUTINE', lines: [{ product: 'FFP', abo: 'AB', rhd: 'NEG', qty: 2 }] });
    },
  },
  {
    name: 'the supplier may confirm fewer units or none: partly filled and unfilled',
    kind: 'feature',
    step: 'supplier-orders',
    run: async (createApp) => {
      const answers = [[2], [0], [0]];
      const { app } = setup(createApp, [{ component: 'platelets', group: 'O+', units: 1 }], { submit: (_r, n) => ({ allocate: answers[n] }) });
      const a = await app.request(ask('O+', 5, false, 'platelets'));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.outstanding, a.status, a.supplierOrder], [1, 2, 2, 'partly filled', 'HL-7001']);
      const b = await app.request(ask('O+', 3, false, 'platelets'));
      assert.deepEqual([b.fromStock, b.fromSupplier, b.outstanding, b.status, b.supplierOrder], [0, 0, 3, 'unfilled', 'HL-7002']);
    },
  },
  {
    name: 'a request the fridge covers does not ask the supplier and names no order',
    kind: 'feature',
    step: 'supplier-orders',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'B-', units: 2 }]);
      const a = await app.request(ask('B-', 2, true));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.outstanding, a.status, a.supplierOrder], [2, 0, 0, 'filled', null]);
      assert.equal(orders(fake).length, 0);
    },
  },
  {
    name: 'a supplier failure fails the request and takes none of our stock',
    kind: 'feature',
    step: 'supplier-orders',
    run: async (createApp) => {
      let down = true;
      const { app } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 2 }], { submit: () => (down ? { fail: 503 } : {}) });
      await assert.rejects(app.request(ask('A+', 5)));
      down = false;
      const a = await app.request(ask('A+', 5));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.status], [2, 3, 'filled']);
    },
  },
  {
    name: 'an embargo puts the request on hold with our reason and the lift time, fridge units still given',
    kind: 'feature',
    step: 'embargo',
    run: async (createApp) => {
      const until = in1h();
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'O-', units: 1 }], {
        submit: (r) => (r.lines[0]?.product === 'RBC' && r.lines[0]?.rhd === 'NEG' && r.lines[0]?.abo === 'O' ? embargo('REGIONAL_SHORTAGE', until) : r.lines[0]?.product === 'PLT' ? embargo('TTI_QUARANTINE', until) : {}),
      });
      const a = await app.request(ask('O-', 3));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.outstanding, a.status, a.holdReason, a.holdUntil], [1, 0, 2, 'on hold', 'shortage', until]);
      const b = await app.request(ask('O-', 2, true));
      assert.deepEqual([b.fromStock, b.outstanding, b.status, b.holdReason, b.holdUntil], [0, 2, 'on hold', 'shortage', until]);
      assert.equal(orders(fake).length, 1, 'the held group is not asked again');
      const c = await app.request(ask('O-', 1, false, 'plasma'));
      assert.deepEqual([c.fromSupplier, c.status, c.holdReason, c.holdUntil], [1, 'filled', null, null]);
      const d = await app.request(ask('B+', 2, false, 'platelets'));
      assert.deepEqual([d.status, d.holdReason], ['on hold', 'quarantine']);
      assert.equal(orders(fake).length, 3);
    },
  },
  {
    name: 'a hold is kept per component and group, a request the fridge covers is filled with no hold, and a hold ends at its lift time',
    kind: 'feature',
    step: 'embargo',
    run: async (createApp) => {
      const liftsAt = new Date(Date.now() + 300).toISOString();
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'A-', units: 1 }], { submit: (_r, n) => (n === 0 ? embargo('REGIONAL_SHORTAGE', liftsAt) : {}) });
      await app.request(ask('A-', 4, false, 'platelets'));
      const covered = await app.request(ask('A-', 1));
      assert.deepEqual([covered.status, covered.holdReason, covered.holdUntil], ['filled', null, null]);
      await sleep(400);
      const after = await app.request(ask('A-', 4, false, 'platelets'));
      assert.deepEqual([after.fromSupplier, after.status, after.holdReason], [4, 'filled', null]);
      assert.equal(orders(fake).length, 2);
    },
  },
  {
    name: 'any other supplier failure fails the request and puts nothing on hold',
    kind: 'feature',
    step: 'embargo',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [], { submit: (_r, n) => (n === 0 ? { fail: 502 } : {}) });
      await assert.rejects(app.request(ask('B+', 2)));
      const a = await app.request(ask('B+', 2));
      assert.deepEqual([a.fromSupplier, a.status, a.holdReason, a.holdUntil], [2, 'filled', null, null]);
      assert.equal(orders(fake).length, 2);
    },
  },
  {
    name: 'urgent red cells are covered with O negative: fridge first, then a second emergency order',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 1 }, { component: 'red cells', group: 'O-', units: 2 }], { submit: () => ({ allocate: [1] }) });
      const a = await app.request(ask('A+', 6, true));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.substituted, a.outstanding, a.status, a.supplierOrder, a.coverOrder], [1, 1, 3, 1, 'partly filled', 'HL-7001', 'HL-7002']);
      assert.deepEqual(orders(fake), [
        { priority: 'STAT', lines: [{ product: 'RBC', abo: 'A', rhd: 'POS', qty: 5 }] },
        { priority: 'STAT', lines: [{ product: 'RBC', abo: 'O', rhd: 'NEG', qty: 2 }] },
      ]);
    },
  },
  {
    name: 'when the O negative fridge covers the rest, the supplier is not asked for O negative',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'O-', units: 3 }], { submit: () => ({ allocate: [0] }) });
      const a = await app.request(ask('B+', 3, true));
      assert.deepEqual([a.fromStock, a.fromSupplier, a.substituted, a.outstanding, a.status, a.coverOrder], [0, 0, 3, 0, 'filled', null]);
      assert.equal(orders(fake).length, 1);
    },
  },
  {
    name: 'no cover for routine requests, platelets, plasma or O negative requests',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [{ component: 'red cells', group: 'O-', units: 5 }, { component: 'platelets', group: 'O-', units: 5 }], { submit: () => ({ allocate: [0] }) });
      for (const input of [ask('A+', 2), ask('A+', 2, true, 'platelets'), ask('A+', 2, true, 'plasma')]) {
        const a = await app.request(input);
        assert.deepEqual([a.substituted, a.coverOrder, a.outstanding, a.status], [0, null, 2, 'unfilled']);
      }
      const o = await app.request(ask('O-', 7, true));
      assert.deepEqual([o.fromStock, o.substituted, o.coverOrder, o.outstanding], [5, 0, null, 2]);
      assert.equal(orders(fake).length, 4);
      assert.ok(orders(fake).every((r) => r.lines.length === 1));
    },
  },
  {
    name: 'a held group is still covered; the hold fields and status tell only the requested group',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      const until = in1h();
      const { app, fake } = setup(createApp, [], { submit: (r) => (r.lines[0]?.abo === 'A' ? embargo('TTI_QUARANTINE', until) : {}) });
      const first = await app.request(ask('A+', 2, true));
      assert.deepEqual([first.fromSupplier, first.substituted, first.outstanding, first.status, first.supplierOrder, first.coverOrder, first.holdReason, first.holdUntil], [0, 2, 0, 'filled', null, 'HL-7002', 'quarantine', until]);
      const again = await app.request(ask('A+', 1, true));
      assert.deepEqual([again.substituted, again.status, again.holdReason, again.coverOrder], [1, 'filled', 'quarantine', 'HL-7003']);
      assert.deepEqual(orders(fake).map((r) => r.lines[0]?.abo), ['A', 'O', 'O'], 'the held group is not asked again');
    },
  },
  {
    name: 'an O negative hold met while covering leaves units outstanding without an on hold status',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      const until = in1h();
      const { app, fake } = setup(createApp, [], { submit: (r) => (r.lines[0]?.rhd === 'NEG' ? embargo('REGIONAL_SHORTAGE', until) : { allocate: [1] }) });
      const a = await app.request(ask('B+', 3, true));
      assert.deepEqual([a.fromSupplier, a.substituted, a.outstanding, a.status, a.coverOrder, a.holdReason, a.holdUntil], [1, 0, 2, 'partly filled', null, null, null]);
      const b = await app.request(ask('AB+', 2, true));
      assert.deepEqual([b.fromSupplier, b.substituted, b.outstanding, b.status], [1, 0, 1, 'partly filled']);
      assert.deepEqual(orders(fake).map((r) => r.lines[0]?.abo), ['B', 'O', 'AB'], 'held O negative is not asked again');
      const own = await app.request(ask('O-', 1));
      assert.deepEqual([own.status, own.holdReason, own.holdUntil], ['on hold', 'shortage', until]);
    },
  },
  {
    name: 'a failed O negative order fails the whole request and takes none of our stock',
    kind: 'feature',
    step: 'o-negative-cover',
    run: async (createApp) => {
      let down = true;
      const { app } = setup(createApp, [{ component: 'red cells', group: 'A+', units: 1 }, { component: 'red cells', group: 'O-', units: 1 }], {
        submit: (r) => (r.lines[0]?.rhd === 'NEG' && down ? { fail: 503 } : { allocate: [0] }),
      });
      await assert.rejects(app.request(ask('A+', 4, true)));
      down = false;
      const a = await app.request(ask('A+', 4, true));
      assert.deepEqual([a.fromStock, a.substituted], [1, 1]);
    },
  },
];
