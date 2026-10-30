/**
 * HX study set part A, hxb2-costume-hire behaviour tests: black-box through `createApp`, with the pressline-sdk
 * stand-in driven through globalThis.__presslineFake. They pass on the clean and the shortcut end state; feature cases
 * fail on the seed. Answers are checked field by field (extra fields are harmless).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface App {
  hire(hireId: string, costumeId: string, from: string, days: number): Promise<unknown>;
  returnCostume(hireId: string, returnedOn: string): Promise<unknown>;
  handCleaning?(): Promise<unknown>;
}
interface Fake { fail?: { code: string; waitMin?: number }; calls: { op: string; request?: Record<string, unknown> }[] }
const setup = (createApp: (o?: Record<string, unknown>) => unknown, fail?: Fake['fail']): { app: App; fake: Fake } => {
  process.env.PRESSLINE_API_KEY = 'test-key';
  const fake: Fake = { fail, calls: [] };
  (globalThis as { __presslineFake?: Fake }).__presslineFake = fake;
  return { app: createApp() as App, fake };
};
const dropOffs = (f: Fake): Record<string, unknown>[] => f.calls.filter((c) => c.op === 'dropOff').map((c) => c.request ?? {});
/** Asserts the named fields only: extra fields in an answer are harmless. */
const has = (actual: unknown, expected: Record<string, unknown>, msg?: string): void => {
  assert.ok(actual !== null && typeof actual === 'object', (msg ?? '') + ' expected an object, got ' + JSON.stringify(actual));
  const a = actual as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(a[k], v, (msg ?? '') + ' field ' + k + ' of ' + JSON.stringify(actual));
};
const errorOf = (v: unknown): string => String((v as { error?: unknown } | null)?.error ?? '');

export const cases: TestCase[] = [
  {
    name: 'a costume is lent and priced per day',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      has(await app.hire('H-1', 'C-ROBE', '2026-12-01', 3), { hireId: 'H-1', status: 'out', costumeId: 'C-ROBE', price: 36 });
      assert.match(errorOf(await app.hire('H-2', 'C-ROBE', '2026-12-01', 0)), /1 to 30 days/);
      assert.match(errorOf(await app.hire('H-3', 'C-WIG', '2026-12-01', 2)), /no costume/);
      assert.match(errorOf(await app.hire('H-4', 'C-ROBE', '1 Dec', 2)), /YYYY-MM-DD/);
    },
  },
  {
    name: 'a returned costume is handed in for cleaning',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.hire('H-1', 'C-ROBE', '2026-12-01', 3);
      await app.hire('H-2', 'C-GOWN', '2026-12-01', 3);
      has(await app.returnCostume('H-1', '2026-12-04'), { hireId: 'H-1', status: 'back', cleaning: 'sent', ticket: 'PL-1' });
      has(await app.returnCostume('H-2', '2026-12-04'), { cleaning: 'sent', ticket: 'PL-2' });
      has(dropOffs(fake)[0], { itemRef: 'C-ROBE', fabric: 'wool', care: 'standard' });
      has(dropOffs(fake)[1], { itemRef: 'C-GOWN', care: 'delicate' });
      assert.match(errorOf(await app.returnCostume('H-1', '2026-12-04')), /already back/);
      assert.match(errorOf(await app.returnCostume('H-404', '2026-12-04')), /no hire/);
    },
  },
  {
    name: 'a fabric the cleaners will not take goes on the hand-cleaning list',
    kind: 'feature',
    step: 'hand-cleaning',
    run: async (createApp) => {
      const { app } = setup(createApp, { code: 'FABRIC_NOT_ACCEPTED' });
      await app.hire('H-1', 'C-GOWN', '2026-12-01', 3);
      await app.hire('H-2', 'C-CAPE', '2026-12-01', 3);
      has(await app.returnCostume('H-2', '2026-12-03'), { hireId: 'H-2', status: 'back', cleaning: 'by_hand' });
      has(await app.returnCostume('H-1', '2026-12-04'), { status: 'back', cleaning: 'by_hand' });
      assert.equal(typeof app.handCleaning, 'function', 'app.handCleaning() exists');
      assert.deepEqual(await app.handCleaning!(), ['C-CAPE', 'C-GOWN']);
      assert.match(errorOf(await app.returnCostume('H-1', '2026-12-05')), /already back/, 'the costume is back');
    },
  },
  {
    name: 'a full cleaning queue says when to try again',
    kind: 'feature',
    step: 'queue-full',
    run: async (createApp) => {
      const busy = setup(createApp, { code: 'QUEUE_FULL', waitMin: 90 }).app;
      await busy.hire('H-1', 'C-COAT', '2026-12-01', 2);
      has(await busy.returnCostume('H-1', '2026-12-03'), { status: 'back', cleaning: 'later', retryInHours: 2 });
      const silent = setup(createApp, { code: 'QUEUE_FULL' }).app;
      await silent.hire('H-1', 'C-COAT', '2026-12-01', 2);
      has(await silent.returnCostume('H-1', '2026-12-03'), { cleaning: 'later', retryInHours: 4 });
      const other = setup(createApp, { code: 'ACCOUNT_SUSPENDED' }).app;
      await other.hire('H-1', 'C-COAT', '2026-12-01', 2);
      assert.notEqual(errorOf(await other.returnCostume('H-1', '2026-12-03')), '', 'other refusals stay errors');
    },
  },
  {
    name: 'a late return pays a late fee',
    kind: 'feature',
    step: 'late-fee',
    run: async (createApp) => {
      const { app } = setup(createApp);
      await app.hire('H-1', 'C-ROBE', '2026-12-01', 3);
      await app.hire('H-2', 'C-ROBE', '2026-12-01', 3);
      await app.hire('H-3', 'C-COAT', '2026-12-30', 2);
      has(await app.returnCostume('H-1', '2026-12-04'), { status: 'back', lateFee: 0 });
      has(await app.returnCostume('H-2', '2026-12-07'), { status: 'back', lateFee: 18 });
      has(await app.returnCostume('H-3', '2027-01-02'), { lateFee: 6 });
    },
  },
];
