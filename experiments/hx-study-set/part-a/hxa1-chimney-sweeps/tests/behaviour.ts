/**
 * HX study set part A, hxa1-chimney-sweeps behaviour tests: black-box through `createApp`, with the debitora-sdk
 * stand-in driven through globalThis.__debitoraFake. They pass on the clean and the shortcut end state; feature cases
 * fail on the seed. Answers are checked field by field (extra fields are harmless).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface App {
  start(planId: string, address: string, flues: number, sweepsPerYear: number, mandateId: string): Promise<unknown>;
  recordSweep(planId: string, date: string): Promise<unknown>;
  stop(planId: string): Promise<unknown>;
  letter(mandateId: string): Promise<unknown>;
  chargeStatus(paymentId: string): Promise<unknown>;
}
interface Mandate { id: string; status: string; scheme: string; reference: string; next_possible_charge_date: string }
interface Fake { mandates: Record<string, Mandate>; payments: Record<string, Record<string, unknown>>; calls: { op: string; id?: string; request?: Record<string, unknown> }[] }
const mandate = (id: string, status: string, reference = 'SWEEP-0001'): Mandate => ({ id, status, scheme: 'sepa_core', reference, next_possible_charge_date: '2026-11-05' });
const setup = (createApp: (o?: Record<string, unknown>) => unknown, ...mandates: Mandate[]): { app: App; fake: Fake } => {
  process.env.DEBITORA_ACCESS_TOKEN = 'test-token';
  const fake: Fake = { mandates: Object.fromEntries(mandates.map((m) => [m.id, m])), payments: {}, calls: [] };
  (globalThis as { __debitoraFake?: Fake }).__debitoraFake = fake;
  return { app: createApp() as App, fake };
};
const payments = (f: Fake): Record<string, unknown>[] => f.calls.filter((c) => c.op === 'createPayment').map((c) => c.request ?? {});
const NOT_ACTIVE = 'The direct debit is not active yet.';
/** Asserts the named fields only: extra fields in an answer are harmless. */
const has = (actual: unknown, expected: Record<string, unknown>, msg?: string): void => {
  assert.ok(actual !== null && typeof actual === 'object', (msg ?? '') + ' expected an object, got ' + JSON.stringify(actual));
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(a[k], v, (msg ?? '') + ' field ' + k + ' of ' + JSON.stringify(actual));
};
const errorOf = (v: unknown): string => String((v as { error?: unknown } | null)?.error ?? '');

export const cases: TestCase[] = [
  {
    name: 'a plan is priced by its flues',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, mandate('MD-1', 'active'));
      has(await app.start('PL-1', '1 Mill Lane', 2, 2, 'MD-1'), { planId: 'PL-1', status: 'running', fee: 95, sweepsPerYear: 2 });
      assert.match(errorOf(await app.start('PL-2', '1 Mill Lane', 0, 1, 'MD-1')), /1 to 4 flues/);
      assert.match(errorOf(await app.start('PL-3', '1 Mill Lane', 1, 5, 'MD-1')), /1 to 3 sweeps/);
    },
  },
  {
    name: 'the plan letter shows the direct debit as the provider reports it',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, mandate('MD-1', 'active'), mandate('MD-2', 'pending_submission', 'SWEEP-0002'));
      has(await app.letter('MD-1'), { line: 'Direct debit MD-1 (SWEEP-0001): active' });
      has(await app.letter('MD-2'), { line: 'Direct debit MD-2 (SWEEP-0002): pending_submission' });
    },
  },
  {
    name: 'the charge page says where a charge stands in our words',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      fake.payments.PM9 = { id: 'PM9', mandate: 'MD-1', amount: 7000, currency: 'EUR', status: 'paid_out', charge_date: '2026-10-01' };
      fake.payments.PM8 = { id: 'PM8', mandate: 'MD-1', amount: 7000, currency: 'EUR', status: 'charged_back', charge_date: '2026-10-01' };
      fake.payments.PM7 = { id: 'PM7', mandate: 'MD-1', amount: 7000, currency: 'EUR', status: 'submitted', charge_date: '2026-10-01' };
      has(await app.chargeStatus('PM9'), { paymentId: 'PM9', outcome: 'collected' });
      has(await app.chargeStatus('PM8'), { outcome: 'bounced' });
      has(await app.chargeStatus('PM7'), { outcome: 'on_its_way' });
    },
  },
  {
    name: 'a running plan records sweeps; a stopped or unknown plan does not',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, mandate('MD-1', 'active'));
      await app.start('PL-1', '1 Mill Lane', 1, 3, 'MD-1');
      has(await app.recordSweep('PL-1', '2026-03-02'), { planId: 'PL-1', status: 'swept', date: '2026-03-02' });
      assert.match(errorOf(await app.recordSweep('PL-1', '2 March')), /YYYY-MM-DD/);
      assert.match(errorOf(await app.recordSweep('PL-404', '2026-03-02')), /no plan/);
      has(await app.stop('PL-1'), { status: 'stopped' });
      assert.match(errorOf(await app.recordSweep('PL-1', '2026-04-02')), /not running/);
    },
  },
  {
    name: 'a plan starts when the direct debit is active',
    kind: 'feature',
    step: 'start-on-active-mandate',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, mandate('MD-1', 'active'));
      has(await app.start('PL-1', '1 Mill Lane', 1, 1, 'MD-1'), { status: 'running', fee: 70 });
      assert.ok(fake.calls.some((c) => c.op === 'getMandate' && c.id === 'MD-1'), 'the direct debit is looked up');
    },
  },
  {
    name: 'a plan whose direct debit is not active waits and is not kept',
    kind: 'feature',
    step: 'start-on-active-mandate',
    run: async (createApp) => {
      for (const status of ['pending_customer_approval', 'pending_submission', 'submitted', 'suspended_by_payer', 'cancelled', 'expired']) {
        const { app } = setup(createApp, mandate('MD-2', status));
        has(await app.start('PL-2', '4 Kiln Row', 1, 1, 'MD-2'), { status: 'waiting_for_bank', reason: NOT_ACTIVE }, status);
        assert.match(errorOf(await app.recordSweep('PL-2', '2026-03-02')), /no plan/, status);
      }
    },
  },
  {
    name: 'a sweep collects the fee by direct debit',
    kind: 'feature',
    step: 'charge-per-sweep',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, mandate('MD-1', 'active'));
      await app.start('PL-1', '1 Mill Lane', 2, 2, 'MD-1');
      const v = await app.recordSweep('PL-1', '2026-03-02');
      const made = payments(fake);
      assert.equal(made.length, 1, 'one payment is created');
      has(made[0], { mandate: 'MD-1', amount: 9500 });
      has(v, { status: 'swept', charged: 95, paymentId: Object.keys(fake.payments)[0] });
    },
  },
  {
    name: 'a failed collection is reported and the sweep is not counted',
    kind: 'feature',
    step: 'charge-per-sweep',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, mandate('MD-1', 'active'));
      await app.start('PL-1', '1 Mill Lane', 1, 1, 'MD-1');
      fake.mandates['MD-1']!.status = 'cancelled';
      const v = await app.recordSweep('PL-1', '2026-03-02');
      has(v, { status: 'charge_failed' });
      assert.equal((v as { charged?: unknown }).charged, undefined, 'nothing was charged');
      fake.mandates['MD-1']!.status = 'active';
      has(await app.recordSweep('PL-1', '2026-04-02'), { status: 'swept', charged: 70 }, 'the failed sweep did not use the year');
    },
  },
  {
    name: 'a plan covers its number of sweeps each calendar year',
    kind: 'feature',
    step: 'sweeps-per-year',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, mandate('MD-1', 'active'));
      await app.start('PL-1', '1 Mill Lane', 1, 2, 'MD-1');
      has(await app.recordSweep('PL-1', '2026-01-10'), { status: 'swept' });
      has(await app.recordSweep('PL-1', '2026-06-10'), { status: 'swept' });
      assert.equal(errorOf(await app.recordSweep('PL-1', '2026-11-10')), 'This plan has no sweeps left this year.');
      assert.equal(payments(fake).length, 2, 'nothing is charged for the refused sweep');
      has(await app.recordSweep('PL-1', '2027-01-05'), { status: 'swept' });
    },
  },
];
