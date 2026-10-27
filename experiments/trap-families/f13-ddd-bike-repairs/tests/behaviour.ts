/**
 * F13 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface PartLine { sku: string; quantity: number }
interface App {
  bookJob(customer: string, bike: string): string;
  logLabour(jobId: string, hours: number): void;
  receiveParts(sku: string, quantity: number): void;
  job(jobId: string): { status: string; labourHours: number };
  stockOf(sku: string): number;
  notices(): string[];
  completeJob(jobId: string, parts: PartLine[]): unknown;
  approveOverrun(jobId: string): void;
  stockHistory(sku: string): { kind: string; quantity: number; jobId: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
const make = (createApp: Factory): App => createApp() as App;
const stocked = (app: App): App => {
  app.receiveParts('CHAIN-11', 3);
  app.receiveParts('TUBE-700', 5);
  return app;
};

export const cases: TestCase[] = [
  {
    name: 'booking a job sends the customer a notice',
    kind: 'regression',
    run: (createApp) => {
      const app = make(createApp);
      const j = app.bookJob('Lea', 'gravel bike');
      assert.ok(app.notices().some((n) => n.includes(j) && n.includes('booked in')));
      assert.deepEqual(app.job(j), { status: 'open', labourHours: 0 });
    },
  },
  {
    name: 'labour adds up and must be positive',
    kind: 'regression',
    run: (createApp) => {
      const app = make(createApp);
      const j = app.bookJob('Lea', 'gravel bike');
      app.logLabour(j, 1.5);
      app.logLabour(j, 0.75);
      assert.throws(() => app.logLabour(j, 0), /labour must be positive/);
      assert.equal(app.job(j).labourHours, 2.25);
    },
  },
  {
    name: 'receiving parts adds to the stock in whole numbers',
    kind: 'regression',
    run: (createApp) => {
      const app = stocked(make(createApp));
      app.receiveParts('CHAIN-11', 2);
      assert.throws(() => app.receiveParts('CHAIN-11', 0), /positive whole number/);
      assert.throws(() => app.receiveParts('CHAIN-11', 1.5), /positive whole number/);
      assert.equal(app.stockOf('CHAIN-11'), 5);
      assert.equal(app.stockOf('BRAKE-PAD'), 0);
    },
  },
  {
    name: 'completing a job takes its parts off the stock',
    kind: 'feature',
    step: 'job-completion',
    run: (createApp) => {
      const app = stocked(make(createApp));
      const j = app.bookJob('Lea', 'gravel bike');
      app.logLabour(j, 1);
      app.completeJob(j, [{ sku: 'CHAIN-11', quantity: 1 }, { sku: 'TUBE-700', quantity: 2 }]);
      assert.equal(app.job(j).status, 'completed');
      assert.equal(app.stockOf('CHAIN-11'), 2);
      assert.equal(app.stockOf('TUBE-700'), 3);
    },
  },
  {
    name: 'a completion short of stock is refused and nothing changes',
    kind: 'feature',
    step: 'job-completion',
    run: (createApp) => {
      const app = make(createApp);
      app.receiveParts('CHAIN-11', 1);
      app.receiveParts('TUBE-700', 5);
      const j = app.bookJob('Lea', 'gravel bike');
      assert.throws(() => app.completeJob(j, [{ sku: 'TUBE-700', quantity: 1 }, { sku: 'CHAIN-11', quantity: 2 }]), /not enough stock: CHAIN-11 needs 2, 1 on hand/);
      assert.equal(app.job(j).status, 'open');
      assert.equal(app.stockOf('CHAIN-11'), 1);
      assert.equal(app.stockOf('TUBE-700'), 5);
    },
  },
  {
    name: 'unknown jobs, unknown parts and second completions are refused and nothing changes',
    kind: 'feature',
    step: 'job-completion',
    run: (createApp) => {
      const app = stocked(make(createApp));
      assert.equal(typeof app.completeJob, 'function');
      const j = app.bookJob('Lea', 'gravel bike');
      assert.throws(() => app.completeJob('J-9999', [{ sku: 'CHAIN-11', quantity: 1 }]));
      assert.throws(() => app.completeJob(j, [{ sku: 'TUBE-700', quantity: 1 }, { sku: 'BRAKE-PAD', quantity: 1 }]), /unknown part: BRAKE-PAD/);
      assert.equal(app.job(j).status, 'open');
      assert.equal(app.stockOf('TUBE-700'), 5);
      app.completeJob(j, [{ sku: 'CHAIN-11', quantity: 1 }]);
      assert.throws(() => app.completeJob(j, [{ sku: 'CHAIN-11', quantity: 1 }]), /already completed/);
      assert.equal(app.stockOf('CHAIN-11'), 2);
    },
  },
  {
    name: 'a completed job takes no more labour',
    kind: 'feature',
    step: 'job-completion',
    run: (createApp) => {
      const app = stocked(make(createApp));
      const j = app.bookJob('Lea', 'gravel bike');
      app.logLabour(j, 0.5);
      app.completeJob(j, []);
      assert.throws(() => app.logLabour(j, 1), /completed/);
      assert.equal(app.job(j).labourHours, 0.5);
    },
  },
  {
    name: 'a job over the labour cap is refused until the customer approves the overrun',
    kind: 'feature',
    step: 'labour-cap',
    run: (createApp) => {
      const app = stocked(make(createApp));
      const j = app.bookJob('Lea', 'gravel bike');
      app.logLabour(j, 5.5);
      assert.throws(() => app.completeJob(j, [{ sku: 'CHAIN-11', quantity: 1 }]), new RegExp(`labour cap exceeded: ${j} has 5\\.50 h logged, 4\\.00 h allowed without approval`));
      assert.equal(app.job(j).status, 'open');
      assert.equal(app.stockOf('CHAIN-11'), 3);
      app.approveOverrun(j);
      app.completeJob(j, [{ sku: 'CHAIN-11', quantity: 1 }]);
      assert.equal(app.job(j).status, 'completed');
      assert.equal(app.stockOf('CHAIN-11'), 2);
    },
  },
  {
    name: 'exactly the cap needs no approval; approvals are refused for unknown or completed jobs',
    kind: 'feature',
    step: 'labour-cap',
    run: (createApp) => {
      const app = stocked(make(createApp));
      const j = app.bookJob('Lea', 'gravel bike');
      app.logLabour(j, 4);
      app.completeJob(j, [{ sku: 'TUBE-700', quantity: 1 }]);
      assert.equal(app.job(j).status, 'completed');
      assert.throws(() => app.approveOverrun(j), /completed/);
      assert.throws(() => app.approveOverrun('J-9999'));
    },
  },
  {
    name: 'the stock history lists deliveries and uses newest first with the job',
    kind: 'feature',
    step: 'stock-history',
    run: (createApp) => {
      const app = make(createApp);
      app.receiveParts('CHAIN-11', 5);
      app.receiveParts('TUBE-700', 2);
      const j1 = app.bookJob('Lea', 'gravel bike');
      const j2 = app.bookJob('Tom', 'city bike');
      app.completeJob(j1, [{ sku: 'CHAIN-11', quantity: 2 }, { sku: 'TUBE-700', quantity: 1 }]);
      app.receiveParts('CHAIN-11', 3);
      app.completeJob(j2, [{ sku: 'CHAIN-11', quantity: 1 }]);
      assert.deepEqual(app.stockHistory('CHAIN-11'), [
        { kind: 'used', quantity: 1, jobId: j2 },
        { kind: 'received', quantity: 3, jobId: null },
        { kind: 'used', quantity: 2, jobId: j1 },
        { kind: 'received', quantity: 5, jobId: null },
      ]);
      assert.deepEqual(app.stockHistory('TUBE-700'), [
        { kind: 'used', quantity: 1, jobId: j1 },
        { kind: 'received', quantity: 2, jobId: null },
      ]);
    },
  },
];
