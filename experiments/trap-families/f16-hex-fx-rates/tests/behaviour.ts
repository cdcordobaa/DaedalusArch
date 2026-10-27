/**
 * F16 behaviour tests: black-box through `createApp` (the seed's entry), with the ratewise-sdk stand-in driven through
 * globalThis.__ratewiseFake. They must pass on the clean and the trap end state; feature cases fail on the seed.
 * Rate ages are set relative to the real clock (1, 2, 23 or 25 hours old), so no clock is injected; amounts are
 * compared to within 1e-9 and no test price falls on a rounding half.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface PriceView { sku: string; name?: string; currency: string; amount?: number; estimated?: boolean; reason?: string }
interface CurrencyView { code: string; name: string; decimals: number }
interface App {
  price(sku: string, currency: string): Promise<PriceView>;
  currencies(): Promise<CurrencyView[]>;
}
interface Fake { down: boolean; calls: { op: string; request?: unknown }[]; latest: (r: unknown) => unknown; currencies: (r: unknown) => unknown }
interface LatestRequest { base: string; symbols: string[] }
const HOUR = 3600 * 1000;
const rate = (symbol: string, mid: number, hoursOld = 1, quality = 'FIRM', minorUnits = 2) => ({
  symbol, mid, asOf: new Date(Date.now() - hoursOld * HOUR).toISOString(), quality, minorUnits,
});
const answer = (...rates: unknown[]) => () => ({ base: 'EUR', rates });

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fake: Partial<Fake> = {}): { app: App; fake: Fake } => {
  process.env.RATEWISE_API_KEY = 'test-key';
  const f: Fake = { down: false, calls: [], latest: answer(rate('USD', 1.0843)), currencies: () => [], ...fake };
  (globalThis as { __ratewiseFake?: Fake }).__ratewiseFake = f;
  return { app: createApp() as App, fake: f };
};
const latestRequests = (f: Fake): LatestRequest[] => f.calls.filter((c) => c.op === 'latest').map((c) => c.request as LatestRequest);
const NOT_NOW = 'Prices in this currency are not available right now.';
const near = (actual: number | undefined, expected: number, what: string): void => {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${what}: expected ${String(expected)}, got ${String(actual)}`);
};
const priced = (v: PriceView, currency: string, amount: number, what: string): void => {
  assert.equal(v.currency, currency, what);
  assert.equal(v.reason, undefined, what);
  near(v.amount, amount, what);
};
const refused = (v: PriceView, what: string): void => {
  assert.equal(v.amount, undefined, what);
  assert.equal(v.reason, NOT_NOW, what);
};

export const cases: TestCase[] = [
  {
    name: 'the currencies the store offers are listed with their decimals',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, {
        currencies: () => [{ isoCode: 'USD', displayName: 'US dollar', minorUnits: 2, status: 'ACTIVE' }, { isoCode: 'JPY', displayName: 'Japanese yen', minorUnits: 0, status: 'ACTIVE' }],
      });
      assert.deepEqual(await app.currencies(), [{ code: 'USD', name: 'US dollar', decimals: 2 }, { code: 'JPY', name: 'Japanese yen', decimals: 0 }]);
      const req = fake.calls.find((c) => c.op === 'currencies')?.request as { status: string };
      assert.equal(req.status, 'ACTIVE');
    },
  },
  {
    name: 'euro prices are shown as they are, and bad requests are refused before anything else',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const mug = await app.price('MUG-01', 'EUR');
      assert.deepEqual([mug.sku, mug.currency], ['MUG-01', 'EUR']);
      near(mug.amount, 12.9, 'mug in euros');
      near((await app.price('STK-03', 'EUR')).amount, 0.02, 'sticker in euros');
      await assert.rejects(app.price('MUG-01', 'usd'), /three-letter/);
      await assert.rejects(app.price('MUG-01', 'EURO'), /three-letter/);
      await assert.rejects(app.price('NOPE-99', 'USD'), /unknown product/);
      assert.equal(latestRequests(fake).length, 0);
    },
  },
  {
    name: 'a price in another currency uses the Ratewise rate, rounded to two decimals',
    kind: 'feature',
    step: 'live-prices',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { latest: answer(rate('USD', 1.0843)) });
      priced(await app.price('MUG-01', 'USD'), 'USD', 13.99, 'mug in dollars (12.90 x 1.0843 = 13.98747)');
      const reqs = latestRequests(fake);
      assert.equal(reqs.length, 1);
      assert.deepEqual([reqs[0]!.base, reqs[0]!.symbols], ['EUR', ['USD']]);
      const gbp = setup(createApp, { latest: answer(rate('GBP', 0.8571, 23)) }).app;
      priced(await gbp.price('TEE-02', 'GBP'), 'GBP', 21, 'T-shirt in pounds (24.50 x 0.8571 = 20.99895), rate 23 hours old');
    },
  },
  {
    name: 'an indicative rate, a rate older than a day or no rate at all is never used',
    kind: 'feature',
    step: 'live-prices',
    run: async (createApp) => {
      refused(await setup(createApp, { latest: answer(rate('USD', 1.0843, 1, 'INDICATIVE')) }).app.price('MUG-01', 'USD'), 'indicative rate');
      refused(await setup(createApp, { latest: answer(rate('USD', 1.0843, 25)) }).app.price('MUG-01', 'USD'), 'rate 25 hours old');
      refused(await setup(createApp, { latest: answer() }).app.price('MUG-01', 'USD'), 'no rate');
      refused(await setup(createApp, { latest: answer(rate('GBP', 0.8571)) }).app.price('MUG-01', 'USD'), 'a rate for another currency only');
    },
  },
  {
    name: 'when Ratewise is down the last usable rate gives an estimated price',
    kind: 'feature',
    step: 'provider-down',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { latest: answer(rate('USD', 1.1, 2)) });
      const live = await app.price('MUG-01', 'USD');
      priced(live, 'USD', 14.19, 'mug in dollars from Ratewise');
      assert.equal(live.estimated, false);
      assert.equal((await app.price('MUG-01', 'EUR')).estimated, false, 'euro prices are not estimated');
      fake.down = true;
      const before = latestRequests(fake).length;
      const est = await app.price('TEE-02', 'USD');
      assert.equal(latestRequests(fake).length, before + 1, 'Ratewise is tried first');
      priced(est, 'USD', 26.95, 'T-shirt in dollars from the last rate (24.50 x 1.1)');
      assert.equal(est.estimated, true);
      refused(await app.price('MUG-01', 'GBP'), 'no earlier rate for pounds');
      await assert.rejects(app.price('MUG-01', 'gbp'), /three-letter/);
    },
  },
  {
    name: 'only a usable rate is kept, and a working Ratewise is never second-guessed',
    kind: 'feature',
    step: 'provider-down',
    run: async (createApp) => {
      const a = setup(createApp, { latest: answer(rate('USD', 1.1, 1, 'INDICATIVE')) });
      refused(await a.app.price('MUG-01', 'USD'), 'indicative rate');
      a.fake.down = true;
      refused(await a.app.price('MUG-01', 'USD'), 'an indicative rate is not kept');
      const b = setup(createApp, { latest: answer(rate('USD', 1.1, 25)) });
      refused(await b.app.price('MUG-01', 'USD'), 'old rate');
      b.fake.down = true;
      refused(await b.app.price('MUG-01', 'USD'), 'an old rate is not kept');
      const c = setup(createApp, { latest: answer(rate('USD', 1.1, 1)) });
      priced(await c.app.price('MUG-01', 'USD'), 'USD', 14.19, 'usable rate');
      c.fake.latest = answer(rate('USD', 1.2, 1, 'INDICATIVE'));
      refused(await c.app.price('MUG-01', 'USD'), 'Ratewise answers with an unusable rate: no fall back');
      c.fake.latest = answer();
      refused(await c.app.price('MUG-01', 'USD'), 'Ratewise answers with no rate: no fall back');
    },
  },
  {
    name: 'prices are rounded the way each currency is written',
    kind: 'feature',
    step: 'rounding',
    run: async (createApp) => {
      const one = async (sku: string, r: ReturnType<typeof rate>): Promise<PriceView> => setup(createApp, { latest: answer(r) }).app.price(sku, r.symbol);
      priced(await one('MUG-01', rate('JPY', 162.37, 1, 'FIRM', 0)), 'JPY', 2095, 'yen, no decimals (2094.573)');
      priced(await one('MUG-01', rate('KWD', 0.33317, 1, 'FIRM', 3)), 'KWD', 4.298, 'dinar, three decimals (4.297893)');
      priced(await one('MUG-01', rate('USD', 1.0843, 1, 'FIRM', 2)), 'USD', 13.99, 'dollars, two decimals');
      priced(await one('MUG-01', rate('CHF', 0.9372, 1, 'FIRM', 2)), 'CHF', 12.1, 'francs to 0.05 (12.08988)');
      priced(await one('TEE-02', rate('CHF', 0.9372, 1, 'FIRM', 2)), 'CHF', 22.95, 'francs to 0.05 (22.9614)');
      priced(await one('STK-03', rate('GBP', 0.2, 1, 'FIRM', 2)), 'GBP', 0.01, 'never zero, pounds (0.004)');
      priced(await one('STK-03', rate('JPY', 0.01, 1, 'FIRM', 0)), 'JPY', 1, 'never zero, yen (0.0002)');
      priced(await one('STK-03', rate('CHF', 0.5, 1, 'FIRM', 2)), 'CHF', 0.05, 'never zero, francs (0.01)');
      priced(await one('STK-03', rate('KWD', 0.1, 1, 'FIRM', 3)), 'KWD', 0.002, 'dinar (0.002)');
      near((await setup(createApp).app.price('STK-03', 'EUR')).amount, 0.02, 'euro prices do not change');
    },
  },
  {
    name: 'estimated prices are rounded in the same way',
    kind: 'feature',
    step: 'rounding',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, { latest: answer(rate('JPY', 162.37, 2, 'FIRM', 0)) });
      priced(await app.price('MUG-01', 'JPY'), 'JPY', 2095, 'yen from Ratewise');
      fake.down = true;
      const est = await app.price('TEE-02', 'JPY');
      priced(est, 'JPY', 3978, 'T-shirt in yen from the last rate (3978.065)');
      assert.equal(est.estimated, true);
      const chf = setup(createApp, { latest: answer(rate('CHF', 0.5, 2, 'FIRM', 2)) });
      priced(await chf.app.price('MUG-01', 'CHF'), 'CHF', 6.45, 'francs (6.45)');
      chf.fake.down = true;
      priced(await chf.app.price('STK-03', 'CHF'), 'CHF', 0.05, 'estimated sticker in francs, never zero');
    },
  },
];
