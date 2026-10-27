/**
 * F2 behaviour tests: black-box through `createApp` (the seed's entry), with the paystream-sdk stand-in driven through
 * globalThis.__paystreamFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface CheckoutView { orderId: string; status: string; amount: number; currency: string; reference?: string; message?: string }
interface App {
  checkout(orderId: string, total: number, currency: string, cardToken: string): Promise<CheckoutView>;
  refund(paymentReference: string, amount: number, currency: string): Promise<{ reference: string; settled: boolean }>;
}
interface Fake { down: boolean; calls: { op: string; request?: unknown }[]; charge: (r: unknown) => unknown; refund: (r: unknown) => unknown }
interface ChargeRequest { amountMinor: number; currency: string; source: { token: string } }
const succeeded = (r: unknown) => {
  const req = r as ChargeRequest;
  return { chargeId: 'ch_123', state: 'SUCCEEDED', amountMinor: req.amountMinor, currency: req.currency };
};
const declined = (declineCode: string) => (r: unknown) => {
  const req = r as ChargeRequest;
  return { chargeId: 'ch_999', state: 'DECLINED', amountMinor: req.amountMinor, currency: req.currency, declineCode };
};

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.PAYSTREAM_API_KEY = 'test-key';
  const f: Fake = { down: false, calls: [], charge: succeeded, refund: () => ({ refundId: 're_1', state: 'SUCCEEDED' }), ...fake };
  (globalThis as { __paystreamFake?: Fake }).__paystreamFake = f;
  return { app: createApp() as App, fake: f };
};
const chargeRequests = (f: Fake): ChargeRequest[] => f.calls.filter((c) => c.op === 'charge').map((c) => c.request as ChargeRequest);

export const cases: TestCase[] = [
  {
    name: 'a refund goes back on the card payment it names',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { refund: () => ({ refundId: 're_7', state: 'QUEUED' }) });
      assert.deepEqual(await app.refund('ch_55', 12.5, 'EUR'), { reference: 're_7', settled: false });
      const req = fake.calls.find((c) => c.op === 'refund')?.request as { chargeId: string; amountMinor: number; currency: string };
      assert.deepEqual([req.chargeId, req.amountMinor, req.currency], ['ch_55', 1250, 'EUR']);
      await assert.rejects(app.refund('ch_55', 0, 'EUR'), /positive/);
    },
  },
  {
    name: 'an invalid order is refused at checkout',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await assert.rejects(app.checkout('A-1', 0, 'EUR', 'tok_visa'), /amount/);
      await assert.rejects(app.checkout('A-1', 10, 'euro', 'tok_visa'), /three-letter/);
      assert.equal(chargeRequests(fake).length, 0);
    },
  },
  {
    name: 'checkout charges the card the order total plus the 1.5% card surcharge',
    kind: 'feature',
    step: 'card-payments',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const v = await app.checkout('A-1', 40, 'EUR', 'tok_visa');
      assert.deepEqual([v.orderId, v.status, v.amount, v.currency, v.reference], ['A-1', 'paid', 40.6, 'EUR', 'ch_123']);
      const reqs = chargeRequests(fake);
      assert.equal(reqs.length, 1);
      assert.deepEqual([reqs[0]!.amountMinor, reqs[0]!.currency, reqs[0]!.source.token], [4060, 'EUR', 'tok_visa']);
      const small = await app.checkout('A-2', 12, 'GBP', 'tok_mc');
      assert.deepEqual([small.status, small.amount, small.currency], ['paid', 12.18, 'GBP']);
    },
  },
  {
    name: 'when the payment provider is down the order is placed on invoice, without the surcharge',
    kind: 'feature',
    step: 'provider-down',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { down: true });
      const v = await app.checkout('A-1', 40, 'EUR', 'tok_visa');
      assert.equal(chargeRequests(fake).length, 1, 'the card is tried first');
      assert.deepEqual([v.status, v.amount, v.currency, v.reference], ['invoiced', 40, 'EUR', 'INV-A-1']);
    },
  },
  {
    name: 'card payments are not placed on invoice while the provider answers',
    kind: 'feature',
    step: 'provider-down',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.equal((await app.checkout('A-3', 8, 'EUR', 'tok_visa')).status, 'paid');
    },
  },
  {
    name: 'a declined card is told to the customer in plain words and the order is not placed',
    kind: 'feature',
    step: 'declines',
    run: async (createApp) => {
      const expect = async (code: string, message: string): Promise<void> => {
        const { app } = setup(createApp, { charge: declined(code) });
        const v = await app.checkout('B-1', 25, 'EUR', 'tok_visa');
        assert.deepEqual([v.status, v.message], ['declined', message]);
        assert.notEqual(v.reference, 'INV-B-1');
      };
      await expect('insufficient_funds', 'Your card has insufficient funds.');
      await expect('expired_card', 'Your card has expired.');
      await expect('do_not_honor', 'Your card was declined.');
      await expect('lost_card', 'Your card was declined.');
    },
  },
];
