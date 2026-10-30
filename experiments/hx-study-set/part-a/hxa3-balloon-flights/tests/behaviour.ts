/**
 * HX study set part A, hxa3-balloon-flights behaviour tests: black-box through `createApp`, with the giftjar-sdk
 * stand-in driven through globalThis.__giftjarFake. They pass on the clean and the shortcut end state; feature cases
 * fail on the seed. Answers are checked field by field (extra fields are harmless).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface App {
  schedule(flightId: string, day: string): Promise<unknown>;
  requestSeat(flightId: string, passenger: string, voucherCode: string): Promise<unknown>;
  board(flightId: string, passenger: string): Promise<unknown>;
  manifest(flightId: string): Promise<unknown>;
  voucherLine(code: string): Promise<unknown>;
  extendVoucher(code: string): Promise<unknown>;
}
interface Voucher { code: string; status: string; balance_cents: number; currency: string; expires_on: string }
interface Fake { vouchers: Record<string, Voucher>; extensions: Record<string, string>; calls: { op: string; id?: string; request?: Record<string, unknown> }[] }
const voucher = (code: string, status: string, balance_cents = 20000): Voucher => ({ code, status, balance_cents, currency: 'EUR', expires_on: '2027-06-30' });
const setup = (createApp: (o?: Record<string, unknown>) => unknown, ...vouchers: Voucher[]): { app: App; fake: Fake } => {
  process.env.GIFTJAR_MERCHANT_KEY = 'test-key';
  const fake: Fake = { vouchers: Object.fromEntries(vouchers.map((v) => [v.code, v])), extensions: {}, calls: [] };
  (globalThis as { __giftjarFake?: Fake }).__giftjarFake = fake;
  return { app: createApp() as App, fake };
};
const passengers = async (app: App, flightId: string): Promise<{ passenger: string; status: string; voucherValue: number }[]> => ((await app.manifest(flightId)) as { passengers: { passenger: string; status: string; voucherValue: number }[] }).passengers;
const NOT_USABLE = 'This voucher cannot be used for a flight.';
/** Asserts the named fields only: extra fields in an answer are harmless. */
const has = (actual: unknown, expected: Record<string, unknown>, msg?: string): void => {
  assert.ok(actual !== null && typeof actual === 'object', (msg ?? '') + ' expected an object, got ' + JSON.stringify(actual));
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(a[k], v, (msg ?? '') + ' field ' + k + ' of ' + JSON.stringify(actual));
};
const errorOf = (v: unknown): string => String((v as { error?: unknown } | null)?.error ?? '');

export const cases: TestCase[] = [
  {
    name: 'a flight is scheduled and a seat given',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, voucher('GJ-1', 'activated'));
      has(await app.schedule('F-1', '2026-07-12'), { flightId: 'F-1', status: 'scheduled' });
      has(await app.requestSeat('F-1', 'Ana', 'GJ-1'), { flightId: 'F-1', passenger: 'Ana', status: 'booked' });
      assert.match(errorOf(await app.schedule('F-2', '12 July')), /YYYY-MM-DD/);
      assert.match(errorOf(await app.requestSeat('F-404', 'Ana', 'GJ-1')), /no flight/);
      assert.match(errorOf(await app.requestSeat('F-1', 'Ana', 'GJ-1')), /already has a seat/);
    },
  },
  {
    name: 'the voucher line shows the voucher as the voucher company reports it',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, voucher('GJ-1', 'activated'), voucher('GJ-2', 'expired', 4550));
      has(await app.voucherLine('GJ-1'), { line: 'Voucher GJ-1: 200.00 EUR (activated)' });
      has(await app.voucherLine('GJ-2'), { line: 'Voucher GJ-2: 45.50 EUR (expired)' });
    },
  },
  {
    name: 'asking for more time on a voucher is answered in our words',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, voucher('GJ-1', 'activated'), voucher('GJ-2', 'activated'), voucher('GJ-3', 'expired'));
      fake.extensions['GJ-2'] = 'already_extended';
      fake.extensions['GJ-3'] = 'not_allowed';
      has(await app.extendVoucher('GJ-1'), { code: 'GJ-1', result: 'extended' });
      has(await app.extendVoucher('GJ-2'), { result: 'refused' });
      has(await app.extendVoucher('GJ-3'), { result: 'refused' });
    },
  },
  {
    name: 'the manifest lists the passengers with their voucher value',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, voucher('GJ-1', 'activated'), voucher('GJ-2', 'partially_redeemed', 9000));
      await app.schedule('F-1', '2026-07-12');
      await app.requestSeat('F-1', 'Ana', 'GJ-1');
      await app.requestSeat('F-1', 'Bo', 'GJ-2');
      const list = await passengers(app, 'F-1');
      assert.equal(list.length, 2);
      has(list[0], { passenger: 'Ana', status: 'booked', voucherValue: 200 });
      has(list[1], { passenger: 'Bo', voucherValue: 90 });
      assert.match(errorOf(await app.board('F-1', 'Zed')), /no seat/);
    },
  },
  {
    name: 'a usable voucher gets a seat',
    kind: 'feature',
    step: 'seat-on-usable-voucher',
    run: async (createApp) => {
      for (const status of ['activated', 'partially_redeemed']) {
        const { app, fake } = setup(createApp, voucher('GJ-1', status));
        await app.schedule('F-1', '2026-07-12');
        has(await app.requestSeat('F-1', 'Ana', 'GJ-1'), { status: 'booked' }, status);
        assert.ok(fake.calls.some((c) => c.op === 'lookup' && c.id === 'GJ-1'), 'the voucher is looked up');
      }
    },
  },
  {
    name: 'a voucher that cannot be used gets no seat',
    kind: 'feature',
    step: 'seat-on-usable-voucher',
    run: async (createApp) => {
      for (const status of ['issued', 'redeemed', 'expired', 'blocked']) {
        const { app } = setup(createApp, voucher('GJ-9', status));
        await app.schedule('F-1', '2026-07-12');
        has(await app.requestSeat('F-1', 'Cy', 'GJ-9'), { status: 'voucher_not_usable', reason: NOT_USABLE }, status);
        assert.equal((await passengers(app, 'F-1')).length, 0, status + ': no seat is taken');
      }
    },
  },
  {
    name: 'boarding takes the seat price from the voucher',
    kind: 'feature',
    step: 'redeem-at-boarding',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, voucher('GJ-1', 'activated'));
      await app.schedule('F-1', '2026-07-12');
      await app.requestSeat('F-1', 'Ana', 'GJ-1');
      has(await app.board('F-1', 'Ana'), { status: 'aboard' });
      const r = fake.calls.filter((c) => c.op === 'redeem');
      assert.equal(r.length, 1, 'one redemption');
      has(r[0]!.request, { code: 'GJ-1', amount_cents: 18000, reference: 'F-1' });
      assert.equal(fake.vouchers['GJ-1']!.balance_cents, 2000);
    },
  },
  {
    name: 'boarding asks for a top-up when the voucher is short',
    kind: 'feature',
    step: 'redeem-at-boarding',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, voucher('GJ-1', 'partially_redeemed', 15000));
      await app.schedule('F-1', '2026-07-12');
      await app.requestSeat('F-1', 'Ana', 'GJ-1');
      has(await app.board('F-1', 'Ana'), { status: 'top_up_needed', due: 30 });
      has((await passengers(app, 'F-1'))[0], { status: 'booked' }, 'the passenger is not aboard');
      fake.vouchers['GJ-1']!.balance_cents = 18000;
      has(await app.board('F-1', 'Ana'), { status: 'aboard' });
    },
  },
  {
    name: 'the basket takes eight passengers',
    kind: 'feature',
    step: 'eight-in-the-basket',
    run: async (createApp) => {
      const names = ['Ana', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal', 'Ida'];
      const { app, fake } = setup(createApp, ...names.map((n) => voucher('GJ-' + n, 'activated')));
      await app.schedule('F-1', '2026-07-12');
      for (const n of names.slice(0, 8)) has(await app.requestSeat('F-1', n, 'GJ-' + n), { status: 'booked' }, n);
      has(await app.requestSeat('F-1', 'Ida', 'GJ-Ida'), { status: 'flight_full' });
      assert.equal(fake.calls.filter((c) => c.op === 'lookup').length, 8, 'the ninth voucher is not looked up');
      assert.equal((await passengers(app, 'F-1')).length, 8);
    },
  },
];
