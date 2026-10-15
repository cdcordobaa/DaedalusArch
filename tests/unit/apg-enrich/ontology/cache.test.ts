/** Ontology v0 content-hash cache, cassettes, call budget, retry and stop rule (ModelCaller). */
import * as fs from 'node:fs';
import { MockFailure, MockOntologyProvider, ModelCaller, OntologyCache, cacheKeyOf } from '../../../../src/apg-enrich/ontology/index.js';
import type { CacheMode, OntologyModelRequest } from '../../../../src/apg-enrich/ontology/index.js';
import { tempDir } from './helpers.js';

const SCHEMA = { type: 'object', required: ['n'], properties: { n: { type: 'number' } } } as const;

function req(prompt: string, runIndex = 0): OntologyModelRequest {
  return { pass: 'responsibility', itemId: 'item', itemName: 'Item', runIndex, system: 'sys', prompt, schema: SCHEMA };
}

function caller(mode: CacheMode, dir: string | null, provider: MockOntologyProvider, budget = 100): ModelCaller {
  return new ModelCaller({ provider, cache: new OntologyCache(mode, dir), budget, runId: 'run', promptVersion: 'v-test', now: () => '2026-10-15T00:00:00.000Z' });
}

describe('ontology cache key', () => {
  const base = { promptVersion: 'v', pass: 'rules' as const, provider: 'p', model: 'm', systemHash: 's', schemaHash: 'h', promptHash: 'q', runIndex: 0 };
  it('is deterministic and changes with every part', () => {
    expect(cacheKeyOf(base)).toBe(cacheKeyOf({ ...base }));
    for (const [k, v] of Object.entries({ promptVersion: 'v2', pass: 'capability', provider: 'p2', model: 'm2', systemHash: 's2', schemaHash: 'h2', promptHash: 'q2', runIndex: 1 })) {
      expect(cacheKeyOf({ ...base, [k]: v })).not.toBe(cacheKeyOf(base));
    }
  });
});

describe('ontology model caller', () => {
  let tmp: { dir: string; cleanup: () => void };
  beforeEach(() => { tmp = tempDir('ontology-cache-'); });
  afterEach(() => { tmp.cleanup(); });

  it('records on a miss, then answers the same content from the cache (also across callers)', async () => {
    const mock = new MockOntologyProvider(() => ({ n: 1 }));
    const c1 = caller('record', tmp.dir, mock);
    const a = await c1.call<{ n: number }>(req('class A source'));
    expect(a).toMatchObject({ kind: 'ok', value: { n: 1 }, cached: false });
    if (a.kind === 'ok') expect(a.provenance).toMatchObject({ model: 'mock-ontology', runId: 'run', temperature: null });
    expect(await c1.call(req('class A source'))).toMatchObject({ kind: 'ok', cached: true });
    const c2 = caller('record', tmp.dir, mock);
    expect(await c2.call(req('class A source'))).toMatchObject({ kind: 'ok', cached: true });
    expect(mock.received()).toHaveLength(1);
    // changed content (or another run index) is a miss
    await c2.call(req('class A source, edited'));
    await c2.call(req('class A source', 1));
    expect(mock.received()).toHaveLength(3);
    expect(c2.stats()).toMatchObject({ providerCalls: 2, cacheHits: 1 });
    const files = fs.readdirSync(tmp.dir, { recursive: true }).filter((f) => String(f).endsWith('.json'));
    expect(files).toHaveLength(3);
  });

  it('replays from the cassettes without calling, and counts a miss as invalid', async () => {
    await caller('record', tmp.dir, new MockOntologyProvider(() => ({ n: 2 }))).call(req('p'));
    const never = new MockOntologyProvider(() => { throw new Error('must not be called'); });
    const r = caller('replay', tmp.dir, never);
    expect(await r.call(req('p'))).toMatchObject({ kind: 'ok', value: { n: 2 }, cached: true });
    expect(await r.call(req('other'))).toMatchObject({ kind: 'invalid' });
    expect(r.stats()).toMatchObject({ providerCalls: 0, cassetteMisses: 1, invalid: 1 });
  });

  it('off mode always calls and writes nothing', async () => {
    const mock = new MockOntologyProvider(() => ({ n: 3 }));
    const c = caller('off', null, mock);
    await c.call(req('p'));
    await c.call(req('p'));
    expect(mock.received()).toHaveLength(1); // in-run memo
    expect(() => new OntologyCache('record', null)).toThrow();
  });

  it('enforces the per-project call budget (cache hits are free)', async () => {
    const mock = new MockOntologyProvider(() => ({ n: 1 }));
    const c = caller('record', tmp.dir, mock, 2);
    await c.call(req('a'));
    await c.call(req('b'));
    expect(await c.call(req('c'))).toEqual({ kind: 'budget' });
    expect(await c.call(req('a'))).toMatchObject({ kind: 'ok', cached: true });
    expect(c.stats()).toMatchObject({ providerCalls: 2, skippedForBudget: 1 });
  });

  it('retries a schema-invalid answer once, then gives up as invalid', async () => {
    let n = 0;
    const flaky = new MockOntologyProvider(() => (++n === 1 ? { wrong: true } : { n: 5 }));
    expect(await caller('off', null, flaky).call(req('p'))).toMatchObject({ kind: 'ok', value: { n: 5 } });
    const bad = new MockOntologyProvider(() => ({ wrong: true }));
    const c = caller('record', tmp.dir, bad);
    expect(await c.call(req('p'))).toMatchObject({ kind: 'invalid' });
    expect(bad.received()).toHaveLength(2);
    expect(fs.existsSync(tmp.dir) ? fs.readdirSync(tmp.dir) : []).toHaveLength(0);
    const exit = new MockOntologyProvider(() => new MockFailure('LLM_CLI_EXIT'));
    expect(await caller('off', null, exit).call(req('p'))).toMatchObject({ kind: 'invalid' });
    expect(exit.received()).toHaveLength(2);
  });

  it.each(['LLM_USAGE_LIMIT', 'LLM_AUTH', 'LLM_CLI_ISOLATION', 'LLM_CLI_VERSION_DRIFT'])('stops the run on %s and answers every later call with stopped', async (code) => {
    const mock = new MockOntologyProvider(() => new MockFailure(code, 'limit'));
    const c = caller('record', tmp.dir, mock);
    expect(await c.call(req('p'))).toEqual({ kind: 'stopped' });
    expect(c.stopped).toMatchObject({ code, pass: 'responsibility' });
    expect(await c.call(req('q'))).toEqual({ kind: 'stopped' });
    expect(mock.received()).toHaveLength(1);
  });

  it('can omit prompts from the stored entries', async () => {
    const c = new ModelCaller({ provider: new MockOntologyProvider(() => ({ n: 1 })), cache: new OntologyCache('record', tmp.dir), budget: 5, runId: 'r', promptVersion: 'v', omitPrompts: true });
    await c.call(req('secret source'));
    const file = fs.readdirSync(tmp.dir, { recursive: true }).map(String).find((f) => f.endsWith('.json')) ?? '';
    expect(fs.readFileSync(`${tmp.dir}/${file}`, 'utf8')).not.toContain('secret source');
  });
});
