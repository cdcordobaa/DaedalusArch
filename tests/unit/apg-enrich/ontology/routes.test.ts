/**
 * v1.4 U3 D5: the route registry. `describeRoute` is pure; `openRoute` never calls a factory, and never reads
 * GEMINI_API_KEY, in estimate or replay mode; a Gemini route needs a model. Spied fake factories only.
 */
import { DEFAULT_ROUTE_DEPS, NoCallProvider, ONTOLOGY_ROUTES, checkRoute, describeRoute, openRoute } from '../../../../src/apg-enrich/ontology/index.js';
import type { OpenedRoute, RouteDeps } from '../../../../src/apg-enrich/ontology/index.js';
import { JUDGE_MODEL } from '../../../../src/llm-critic/frozen.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMProvider } from '../../../../src/shared/interfaces/llm-provider.js';

const FAKE_LLM: LLMProvider = {
  name: 'fake',
  describe: () => ({ provider: 'gemini', model: 'gemini-x' }),
  evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_CALL_FAILED', message: 'fake' }])),
};

function fakeDeps(): { deps: RouteDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: RouteDeps = {
    claudeCli: (cfg) => { calls.push(`claude:${cfg.model}`); return Promise.resolve(DomainResult.ok<OpenedRoute>({ provider: new NoCallProvider(describeRoute({ route: 'claude-cli' })), dispose: () => undefined, ready: 'ready' })); },
    geminiApi: (cfg) => { calls.push(`gemini-api:${cfg.model}:${String(cfg.temperature)}:${String(cfg.maxTokens)}`); return Promise.resolve(DomainResult.ok(FAKE_LLM)); },
    agyCli: (cfg) => { calls.push(`agy:${cfg.model}`); return Promise.resolve(DomainResult.ok(FAKE_LLM)); },
  };
  return { deps, calls };
}

/** Counts reads of GEMINI_API_KEY while `fn` runs (process.env swapped for a counting proxy). */
async function keyReads(fn: () => Promise<unknown>): Promise<number> {
  const orig = process.env;
  let reads = 0;
  const copy: NodeJS.ProcessEnv = { ...orig };
  delete copy.GEMINI_API_KEY;
  process.env = new Proxy(copy, { get(t, k) { if (k === 'GEMINI_API_KEY') reads++; return t[k as string]; } });
  try {
    await fn();
  } finally {
    process.env = orig;
  }
  return reads;
}

describe('ontology routes', () => {
  it('lists the four routes and describes each without I/O', async () => {
    expect([...ONTOLOGY_ROUTES]).toEqual(['claude-cli', 'gemini-api', 'gemini-agy', 'mock']);
    const reads = await keyReads(() => {
      expect(describeRoute({ route: 'claude-cli' })).toMatchObject({ provider: 'claude-cli', model: JUDGE_MODEL, temperature: null });
      expect(describeRoute({ route: 'mock' })).toEqual({ provider: 'mock', model: 'mock-ontology', temperature: null });
      expect(describeRoute({ route: 'gemini-api', model: 'gemini-x', temperature: 0 })).toEqual({ provider: 'gemini-api', model: 'gemini-x', temperature: 0 });
      expect(describeRoute({ route: 'gemini-agy', model: 'gemini-x' })).toEqual({ provider: 'gemini-agy', model: 'gemini-x', temperature: null });
      return Promise.resolve();
    });
    expect(reads).toBe(0);
  });

  it('a Gemini route without a model fails, and so does gemini-api without a temperature', async () => {
    expect(checkRoute({ route: 'gemini-api', temperature: 0 })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_NO_MODEL' }] });
    expect(checkRoute({ route: 'gemini-agy' })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_NO_MODEL' }] });
    expect(checkRoute({ route: 'gemini-api', model: 'g' })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_NO_TEMPERATURE' }] });
    expect(checkRoute({ route: 'gemini-agy', model: 'g', temperature: 0 })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_TEMPERATURE_UNSENT' }] });
    expect(() => describeRoute({ route: 'gemini-agy' })).toThrow('--model');
    const { deps, calls } = fakeDeps();
    expect(await openRoute({ route: 'gemini-api', temperature: 0 }, deps, { mode: 'record' })).toMatchObject({ success: false });
    expect(calls).toEqual([]);
  });

  it('estimate and replay never call a factory nor read GEMINI_API_KEY', async () => {
    const { deps, calls } = fakeDeps();
    const reads = await keyReads(async () => {
      for (const mode of ['estimate', 'replay'] as const) {
        for (const spec of [{ route: 'claude-cli' as const }, { route: 'gemini-api' as const, model: 'gemini-x', temperature: 0 }, { route: 'gemini-agy' as const, model: 'gemini-x' }, { route: 'mock' as const }]) {
          const r = await openRoute(spec, deps, { mode });
          expect(r.success).toBe(true);
          if (r.success) {
            expect(r.data.provider).toBeInstanceOf(NoCallProvider);
            expect(r.data.provider.describe()).toEqual(describeRoute(spec));
          }
        }
      }
    });
    expect(calls).toEqual([]);
    expect(reads).toBe(0);
  });

  it('record opens a live route only through the injected factory, wrapped in the generic adapter', async () => {
    const { deps, calls } = fakeDeps();
    const api = await openRoute({ route: 'gemini-api', model: 'gemini-x', temperature: 0, maxTokens: 64 }, deps, { mode: 'record' });
    expect(api.success && api.data.provider.describe()).toEqual({ provider: 'gemini-api', model: 'gemini-x', temperature: 0 });
    const agy = await openRoute({ route: 'gemini-agy', model: 'gemini-y' }, deps, { mode: 'record' });
    expect(agy.success && agy.data.provider.describe()).toEqual({ provider: 'gemini-agy', model: 'gemini-y', temperature: null });
    await openRoute({ route: 'claude-cli' }, deps, { mode: 'record' });
    expect(calls).toEqual(['gemini-api:gemini-x:0:64', 'agy:gemini-y', `claude:${JUDGE_MODEL}`]);
    expect(await openRoute({ route: 'mock' }, deps, { mode: 'record' })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_MOCK' }] });
  });

  it('the real gemini-api factory refuses to build a provider when the key is absent (no construction, no call)', async () => {
    let result: unknown;
    const reads = await keyReads(async () => { result = await DEFAULT_ROUTE_DEPS.geminiApi({ model: 'gemini-x', temperature: 0, maxTokens: 1 }); });
    expect(reads).toBe(1);
    expect(result).toMatchObject({ success: false, errors: [{ code: 'LLM_AUTH' }] });
  });
});
