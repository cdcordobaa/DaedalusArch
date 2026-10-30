/**
 * HX study set part A, hxa2-canal-boats behaviour tests: black-box through `createApp`, with the covernest-sdk
 * stand-in driven through globalThis.__covernestFake. They pass on the clean and the shortcut end state; feature cases
 * fail on the seed. Answers are checked field by field (extra fields are harmless).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface App {
  reserve(hireId: string, boatId: string, from: string, nights: number, hirerRef: string, quoteRef: string): Promise<unknown>;
  handOver(hireId: string): Promise<unknown>;
  bringBack(hireId: string): Promise<unknown>;
  quoteLine(quoteRef: string): Promise<unknown>;
  checkHirer(hirerRef: string): Promise<unknown>;
}
interface Quote { quoteRef: string; state: string; premiumPence: number; excessPence: number; validUntil: string }
interface Policy { policyNo: string; quoteRef: string; state: string; missingDocs: string[] }
interface Fake { quotes: Record<string, Quote>; policies: Record<string, Policy>; histories: Record<string, { hirerRef: string; band: string; lastClaimOn: string | null }>; calls: { op: string; id?: string }[] }
const quote = (quoteRef: string, state: string, premiumPence = 4250): Quote => ({ quoteRef, state, premiumPence, excessPence: 50000, validUntil: '2026-12-31' });
const policy = (quoteRef: string, state = 'IN_FORCE', missingDocs: string[] = []): Policy => ({ policyNo: 'POL-' + quoteRef, quoteRef, state, missingDocs });
const setup = (createApp: (o?: Record<string, unknown>) => unknown, quotes: Quote[] = [], policies: Policy[] = []): { app: App; fake: Fake } => {
  process.env.COVERNEST_PARTNER_ID = 'wharf-7';
  process.env.COVERNEST_SECRET = 'test-secret';
  const fake: Fake = { quotes: Object.fromEntries(quotes.map((q) => [q.quoteRef, q])), policies: Object.fromEntries(policies.map((p) => [p.quoteRef, p])), histories: {}, calls: [] };
  (globalThis as { __covernestFake?: Fake }).__covernestFake = fake;
  return { app: createApp() as App, fake };
};
const NO_COVER = 'This hire has no cover yet.';
/** Asserts the named fields only: extra fields in an answer are harmless. */
const has = (actual: unknown, expected: Record<string, unknown>, msg?: string): void => {
  assert.ok(actual !== null && typeof actual === 'object', (msg ?? '') + ' expected an object, got ' + JSON.stringify(actual));
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(a[k], v, (msg ?? '') + ' field ' + k + ' of ' + JSON.stringify(actual));
};
const errorOf = (v: unknown): string => String((v as { error?: unknown } | null)?.error ?? '');

export const cases: TestCase[] = [
  {
    name: 'a hire is priced per night plus the cover',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, [quote('Q-1', 'BOUND')]);
      has(await app.reserve('H-1', 'Kestrel', '2026-06-01', 3, 'HR-1', 'Q-1'), { hireId: 'H-1', status: 'reserved', boatId: 'Kestrel', price: 402.5 });
      assert.match(errorOf(await app.reserve('H-2', 'Kestrel', '2026-07-01', 1, 'HR-1', 'Q-1')), /2 to 14 nights/);
      assert.match(errorOf(await app.reserve('H-3', 'Kestrel', '1 July', 3, 'HR-1', 'Q-1')), /YYYY-MM-DD/);
    },
  },
  {
    name: 'the quote line shows the cover as the insurer reports it',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, [quote('Q-1', 'BOUND'), quote('Q-2', 'QUOTED', 3800)]);
      has(await app.quoteLine('Q-1'), { line: 'Quote Q-1: 42.50 GBP cover (BOUND)' });
      has(await app.quoteLine('Q-2'), { line: 'Quote Q-2: 38.00 GBP cover (QUOTED)' });
    },
  },
  {
    name: 'a hirer check reports past claims in our words',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      fake.histories['HR-1'] = { hirerRef: 'HR-1', band: 'NO_CLAIMS', lastClaimOn: null };
      fake.histories['HR-2'] = { hirerRef: 'HR-2', band: 'ONE_CLAIM', lastClaimOn: '2024-08-01' };
      fake.histories['HR-3'] = { hirerRef: 'HR-3', band: 'SEVERAL_CLAIMS', lastClaimOn: '2026-02-01' };
      has(await app.checkHirer('HR-1'), { band: 'none', mayHire: true });
      has(await app.checkHirer('HR-2'), { band: 'low', mayHire: true });
      has(await app.checkHirer('HR-3'), { band: 'high', mayHire: false });
    },
  },
  {
    name: 'a hired boat goes out and comes back',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp, [quote('Q-1', 'BOUND')], [policy('Q-1')]);
      await app.reserve('H-1', 'Kestrel', '2026-06-01', 3, 'HR-1', 'Q-1');
      has(await app.handOver('H-1'), { status: 'on_water' });
      has(await app.bringBack('H-1'), { status: 'returned' });
      assert.match(errorOf(await app.handOver('H-404')), /no hire/);
      assert.match(errorOf(await app.bringBack('H-1')), /not out/);
    },
  },
  {
    name: 'a hire with bound cover is reserved',
    kind: 'feature',
    step: 'reserve-when-bound',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [quote('Q-1', 'BOUND')]);
      has(await app.reserve('H-1', 'Kestrel', '2026-06-01', 2, 'HR-1', 'Q-1'), { status: 'reserved', price: 282.5 });
      assert.ok(fake.calls.some((c) => c.op === 'fetchQuote' && c.id === 'Q-1'), 'the quote is looked up');
    },
  },
  {
    name: 'a hire whose cover is with an underwriter waits and is not kept',
    kind: 'feature',
    step: 'reserve-when-bound',
    run: async (createApp) => {
      const { app } = setup(createApp, [quote('Q-2', 'REFERRED')], [policy('Q-2')]);
      has(await app.reserve('H-2', 'Heron', '2026-06-01', 2, 'HR-1', 'Q-2'), { hireId: 'H-2', status: 'cover_in_review' });
      assert.match(errorOf(await app.handOver('H-2')), /no hire/);
    },
  },
  {
    name: 'a hire without cover is refused and not kept',
    kind: 'feature',
    step: 'reserve-when-bound',
    run: async (createApp) => {
      for (const state of ['QUOTED', 'DECLINED', 'LAPSED']) {
        const { app } = setup(createApp, [quote('Q-3', state)], [policy('Q-3')]);
        has(await app.reserve('H-3', 'Heron', '2026-06-01', 2, 'HR-1', 'Q-3'), { status: 'no_cover', reason: NO_COVER }, state);
        assert.match(errorOf(await app.handOver('H-3')), /no hire/, state);
      }
    },
  },
  {
    name: 'the handover gives the policy number',
    kind: 'feature',
    step: 'policy-at-handover',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [quote('Q-1', 'BOUND')], [policy('Q-1')]);
      await app.reserve('H-1', 'Kestrel', '2026-06-01', 3, 'HR-1', 'Q-1');
      has(await app.handOver('H-1'), { status: 'on_water', policyNo: 'POL-Q-1' });
      assert.ok(fake.calls.some((c) => c.op === 'policyForQuote' && c.id === 'Q-1'), 'the policy is looked up');
    },
  },
  {
    name: 'the handover waits for missing documents and the hire stays reserved',
    kind: 'feature',
    step: 'policy-at-handover',
    run: async (createApp) => {
      const { app, fake } = setup(createApp, [quote('Q-1', 'BOUND')], [policy('Q-1', 'PENDING_DOCS', ['skipper licence', 'crew list'])]);
      await app.reserve('H-1', 'Kestrel', '2026-06-01', 3, 'HR-1', 'Q-1');
      has(await app.handOver('H-1'), { status: 'documents_missing', missing: ['skipper licence', 'crew list'] });
      fake.policies['Q-1'] = policy('Q-1');
      has(await app.handOver('H-1'), { status: 'on_water', policyNo: 'POL-Q-1' }, 'the hire stayed reserved');
    },
  },
  {
    name: 'a boat is out on one hire at a time',
    kind: 'feature',
    step: 'one-boat-one-hire',
    run: async (createApp) => {
      const { app } = setup(createApp, [quote('Q-1', 'BOUND')], [policy('Q-1')]);
      has(await app.reserve('H-1', 'Kestrel', '2026-06-01', 3, 'HR-1', 'Q-1'), { status: 'reserved' });
      assert.equal(errorOf(await app.reserve('H-2', 'Kestrel', '2026-06-03', 2, 'HR-2', 'Q-1')), 'That boat is already booked for those nights.');
      assert.equal(errorOf(await app.reserve('H-5', 'Kestrel', '2026-05-30', 4, 'HR-2', 'Q-1')), 'That boat is already booked for those nights.');
      assert.match(errorOf(await app.handOver('H-2')), /no hire/, 'the refused hire is not kept');
      has(await app.reserve('H-3', 'Kestrel', '2026-06-04', 2, 'HR-2', 'Q-1'), { status: 'reserved' }, 'a hire may start the morning the last one ends');
      has(await app.reserve('H-4', 'Heron', '2026-06-02', 2, 'HR-3', 'Q-1'), { status: 'reserved' }, 'another boat is free');
    },
  },
];
