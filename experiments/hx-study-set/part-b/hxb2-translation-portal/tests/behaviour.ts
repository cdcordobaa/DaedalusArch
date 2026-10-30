/**
 * HX study set part B, hxb2 behaviour tests: black-box through `createApp`, with the wordmarket-sdk stand-in driven
 * through globalThis.__wordmarketFake. They pass on the clean and the trap end state; feature cases fail on the seed.
 * Answers are checked field by field (extra fields are harmless); every entry point a case calls is named in the
 * step text that asks for it.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

type Json = Record<string, unknown>;
interface App {
  placeOrder(form: Json): Promise<Json>;
  postToMarket(orderNo: string): Promise<Json>;
  progress(orderNo: string): Promise<Json>;
  invoice?(orderNo: string): Promise<Json>;
  jobCard(orderNo: string): Promise<Json>;
}
interface Job { state: string; translatorHandle: string | null; updatedAt: string; wordCount: number }
interface Fake { posted: Json[]; jobs: Record<string, Job>; calls: { op: string }[] }
const setup = (createApp: (o?: Json) => unknown): { app: App; fake: Fake } => {
  process.env.WORDMARKET_TOKEN = 'test-token';
  const fake: Fake = { posted: [], jobs: {}, calls: [] };
  (globalThis as { __wordmarketFake?: Fake }).__wordmarketFake = fake;
  return { app: createApp() as App, fake };
};
const ORDER = { orderNo: 'T-1', clientId: 'C-7', sourceLang: 'nl', targetLang: 'en', words: 1200, speed: 'standard' };
const posted = async (app: App, orderNo = 'T-1'): Promise<string> => {
  await app.placeOrder({ ...ORDER, orderNo });
  return String((await app.postToMarket(orderNo)).jobId);
};
const move = (fake: Fake, jobId: string, state: string, translatorHandle: string | null = 'lina_k'): void => {
  fake.jobs[jobId] = { ...fake.jobs[jobId]!, state, translatorHandle, updatedAt: '2026-04-10T09:30:00Z' };
};
const stage = async (app: App, orderNo = 'T-1'): Promise<unknown> => (await app.progress(orderNo)).stage;

export const cases: TestCase[] = [
  {
    name: 'an order is quoted and posted to the marketplace',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const q = await app.placeOrder(ORDER);
      assert.equal(q.orderNo, 'T-1');
      assert.equal(q.priceEuros, 144);
      const p = await app.postToMarket('T-1');
      assert.equal(p.jobId, 'WM-501');
      const input = fake.posted[0]!;
      assert.equal(input.sourceLang, 'nl');
      assert.equal(input.targetLang, 'en');
      assert.equal(input.wordCount, 1200);
      assert.equal(input.turnaround, 'normal');
      assert.equal(input.brief, 'Order T-1 for C-7');
    },
  },
  {
    name: 'small express orders cost the minimum and go out as express',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.equal((await app.placeOrder({ ...ORDER, words: 100, speed: 'express' })).priceEuros, 25);
      await app.postToMarket('T-1');
      assert.equal(fake.posted[0]!.turnaround, 'express');
    },
  },
  {
    name: 'an order needs two different languages',
    kind: 'regression',
    run: async (createApp) => {
      const { app } = setup(createApp);
      assert.match(String((await app.placeOrder({ ...ORDER, targetLang: 'NL' })).error), /languages must differ/);
    },
  },
  {
    name: 'staff see the job card of a posted order',
    kind: 'regression',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const jobId = await posted(app);
      move(fake, jobId, 'drafting');
      assert.equal((await app.jobCard('T-1')).line, 'WM-501 drafting by lina_k (2026-04-10T09:30:00Z)');
    },
  },
  {
    name: 'the customer portal shows where the translation is',
    kind: 'feature',
    step: 'progress',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      await app.placeOrder({ ...ORDER, orderNo: 'T-9' });
      assert.equal(await stage(app, 'T-9'), 'RECEIVED');
      const jobId = await posted(app);
      assert.equal(await stage(app), 'FINDING_TRANSLATOR');
      for (const [state, shown] of [['claimed', 'IN_TRANSLATION'], ['drafting', 'IN_TRANSLATION'], ['delivered', 'DELIVERED']]) {
        move(fake, jobId, state!);
        assert.equal(await stage(app), shown, state);
      }
      const other = await posted(app, 'T-2');
      move(fake, other, 'disputed');
      assert.equal(await stage(app, 'T-2'), 'ON_HOLD');
    },
  },
  {
    name: 'an order is invoiced once the translation is delivered',
    kind: 'feature',
    step: 'invoice',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      assert.equal(typeof app.invoice, 'function', 'createApp() offers invoice(orderNo)');
      await app.placeOrder({ ...ORDER, orderNo: 'T-9' });
      assert.equal((await app.invoice!('T-9')).error, 'The translation is not finished yet.');
      const jobId = await posted(app);
      move(fake, jobId, 'drafting');
      assert.equal((await app.invoice!('T-1')).error, 'The translation is not finished yet.');
      move(fake, jobId, 'delivered');
      const inv = await app.invoice!('T-1');
      assert.equal(inv.orderNo, 'T-1');
      assert.equal(inv.amountEuros, 144);
    },
  },
  {
    name: 'a translation being proofread shows proofreading',
    kind: 'feature',
    step: 'proofreading',
    run: async (createApp) => {
      const { app, fake } = setup(createApp);
      const jobId = await posted(app);
      move(fake, jobId, 'drafting');
      assert.equal(await stage(app), 'IN_TRANSLATION');
      move(fake, jobId, 'proofreading');
      assert.equal(await stage(app), 'PROOFREADING');
      move(fake, jobId, 'delivered');
      assert.equal(await stage(app), 'DELIVERED');
    },
  },
];
