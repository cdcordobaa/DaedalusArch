/**
 * P3 behaviour tests: black-box through `createApp` (the seed's entry), with the fastship-sdk stand-in driven through
 * globalThis.__fastshipFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../tools/run-tests';

interface QuoteView { amount: number; currency: string; service: string; estimated?: boolean }
interface App {
  quote(from: string, to: string, weightGrams: number): Promise<QuoteView>;
  track(no: string): Promise<{ status: string; at: string }[]>;
}
interface Fake { down: boolean; calls: { op: string; request?: unknown }[]; rates: (r: unknown) => unknown; tracking: (n: string) => unknown }
const rate = (serviceCode: string, serviceName: string, value: string) => ({ serviceCode, serviceName, amount: { value, currency: 'EUR' }, transitDays: 2 });
const STANDARD_OFFER = { rates: [rate('EXP', 'Fastship Express', '19.90'), rate('STD', 'Fastship Standard', '12.40'), rate('FREIGHT', 'Fastship Freight', '9.00')] };

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.FASTSHIP_API_KEY = 'test-key';
  const f: Fake = { down: false, calls: [], rates: () => STANDARD_OFFER, tracking: () => [], ...fake };
  (globalThis as { __fastshipFake?: Fake }).__fastshipFake = f;
  return { app: createApp() as App, fake: f };
};
const grams = (req: unknown): number => {
  const w = (req as { parcel: { weight: { value: number; unit: string } } }).parcel.weight;
  return w.unit === 'kg' ? w.value * 1000 : w.value;
};

export const cases: TestCase[] = [
  {
    name: 'tracking lists the parcel steps in plain words',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, { tracking: () => [{ code: 'PICKED_UP', timestamp: '2026-10-20T08:00:00Z' }, { code: 'DELIVERED', timestamp: '2026-10-21T10:00:00Z' }] });
      assert.deepEqual(await app.track('FS123'), [{ status: 'picked up', at: '2026-10-20T08:00:00Z' }, { status: 'delivered', at: '2026-10-21T10:00:00Z' }]);
    },
  },
  {
    name: 'a quote for an invalid parcel is refused',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      await assert.rejects(app.quote('DE', 'FR', 0), /weight/);
      await assert.rejects(app.quote('Germany', 'FR', 500), /two-letter/);
    },
  },
  {
    name: 'a quote is the cheapest live service plus the 1.50 handling fee',
    kind: 'feature',
    step: 'live-rates',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const q = await app.quote('DE', 'FR', 2500);
      assert.deepEqual([q.amount, q.currency, q.service], [13.9, 'EUR', 'Fastship Standard']);
      const req = fake.calls.find((c) => c.op === 'rates')?.request as { origin: { country: string }; destination: { country: string } };
      assert.deepEqual([req.origin.country, req.destination.country, grams(req)], ['DE', 'FR', 2500]);
    },
  },
  {
    name: 'when the carrier is down the quote comes from our table, marked estimated',
    kind: 'feature',
    step: 'carrier-down',
    run: async (createApp) => {
      const { app } = setup(createApp, { down: true });
      const q = await app.quote('DE', 'FR', 2500);
      assert.deepEqual([q.amount, q.service, q.estimated], [21.9, 'House rate', true]);
    },
  },
  {
    name: 'live quotes are not marked estimated',
    kind: 'feature',
    step: 'carrier-down',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.equal((await app.quote('DE', 'DE', 800)).estimated, false);
    },
  },
  {
    name: 'parcels over 20 kg go by freight only, lighter ones never by freight',
    kind: 'feature',
    step: 'freight',
    run: async (createApp) => {
      const { app } = setup(createApp);
      const heavy = await app.quote('DE', 'FR', 25000);
      assert.deepEqual([heavy.amount, heavy.service], [10.5, 'Fastship Freight']);
      const light = await app.quote('DE', 'FR', 20000);
      assert.deepEqual([light.amount, light.service], [13.9, 'Fastship Standard']);
    },
  },
];
