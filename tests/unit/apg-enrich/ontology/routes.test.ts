/**
 * v1.4 U3 D5: the route registry. `describeRoute` is pure; `openRoute` never calls a factory, and never reads
 * GEMINI_API_KEY, in estimate or replay mode; a Gemini route needs a model. Spied fake factories only.
 */
import { DEFAULT_ROUTE_DEPS, NoCallProvider, ONTOLOGY_ROUTES, agyExploratoryVersions, checkRoute, claudeExploratoryVersions, describeRoute, openRoute } from '../../../../src/apg-enrich/ontology/index.js';
import type { OpenedRoute, RouteDeps } from '../../../../src/apg-enrich/ontology/index.js';
import { AGY_EXPLORATORY_VERSIONS, AGY_PINNED_VERSION } from '../../../../src/llm-critic/agy-cli-provider.js';
import { CLAUDE_EXPLORATORY_VERSIONS } from '../../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_MODEL, PINNED_CLI_VERSION } from '../../../../src/llm-critic/frozen.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMProvider } from '../../../../src/shared/interfaces/llm-provider.js';

const FAKE_LLM: LLMProvider = {
  name: 'fake',
  describe: () => ({ provider: 'gemini', model: 'gemini-x' }),
  evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_CALL_FAILED', message: 'fake' }])),
};

function fakeDeps(): { deps: RouteDeps; calls: string[]; agyVersions: (readonly string[] | undefined)[]; claudeVersions: (readonly string[] | undefined)[] } {
  const calls: string[] = [];
  const agyVersions: (readonly string[] | undefined)[] = [];
  const claudeVersions: (readonly string[] | undefined)[] = [];
  const deps: RouteDeps = {
    claudeCli: (cfg) => { calls.push(`claude:${cfg.model}`); claudeVersions.push(cfg.exploratoryVersions); return Promise.resolve(DomainResult.ok<OpenedRoute>({ provider: new NoCallProvider(describeRoute({ route: 'claude-cli' })), dispose: () => undefined, ready: 'ready' })); },
    geminiApi: (cfg) => { calls.push(`gemini-api:${cfg.model}:${String(cfg.temperature)}:${String(cfg.maxTokens)}`); return Promise.resolve(DomainResult.ok(FAKE_LLM)); },
    agyCli: (cfg) => { calls.push(`agy:${cfg.model}`); agyVersions.push(cfg.exploratoryVersions); return Promise.resolve(DomainResult.ok(FAKE_LLM)); },
  };
  return { deps, calls, agyVersions, claudeVersions };
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

  describe('gemini-agy exploratory versions (U9 S1; C4-01 §3 gap 2)', () => {
    it('the shared list is 1.3.6 and 1.4.2, and the frozen labeller pin stays 1.3.2', () => {
      expect([...AGY_EXPLORATORY_VERSIONS]).toEqual(['1.3.6', '1.4.2']);
      expect(AGY_PINNED_VERSION).toBe('1.3.2');
      expect(Object.isFrozen(AGY_EXPLORATORY_VERSIONS)).toBe(true);
    });

    it('an exploratory gemini-agy record passes the shared constant itself (not a copy) to the agy factory', async () => {
      const { deps, agyVersions } = fakeDeps();
      const r = await openRoute({ route: 'gemini-agy', model: 'gemini-y', exploratory: true }, deps, { mode: 'record' });
      expect(r.success).toBe(true);
      expect(agyVersions).toHaveLength(1);
      expect(agyVersions[0]).toBe(AGY_EXPLORATORY_VERSIONS);
      expect(agyExploratoryVersions({ route: 'gemini-agy', exploratory: true })).toBe(AGY_EXPLORATORY_VERSIONS);
    });

    it('without the exploratory label the strict pin holds: no extra versions are passed', async () => {
      const { deps, agyVersions } = fakeDeps();
      await openRoute({ route: 'gemini-agy', model: 'gemini-y' }, deps, { mode: 'record' });
      expect(agyVersions).toEqual([undefined]);
      expect(agyExploratoryVersions({ route: 'gemini-agy' })).toBeUndefined();
    });

    it('exploratory is refused on the routes without a CLI pin, and the cache key (describeRoute) does not change with it', () => {
      expect(checkRoute({ route: 'mock', exploratory: true })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_EXPLORATORY_UNSUPPORTED' }] });
      expect(checkRoute({ route: 'gemini-api', model: 'g', temperature: 0, exploratory: true })).toMatchObject({ success: false, errors: [{ code: 'ONTOLOGY_ROUTE_EXPLORATORY_UNSUPPORTED' }] });
      expect(checkRoute({ route: 'claude-cli', exploratory: true }).success).toBe(true);
      expect(describeRoute({ route: 'gemini-agy', model: 'g', exploratory: true })).toEqual(describeRoute({ route: 'gemini-agy', model: 'g' }));
      expect(describeRoute({ route: 'claude-cli', exploratory: true })).toEqual(describeRoute({ route: 'claude-cli' }));
    });
  });

  describe('claude-cli exploratory allowance (author decision D1, 2026-10-19)', () => {
    it('the frozen judge pin is unchanged and the exploratory list is frozen', () => {
      expect(PINNED_CLI_VERSION).toBe('2.1.294');
      expect(CLAUDE_EXPLORATORY_VERSIONS).toEqual(['2.1.303']);
      expect(Object.isFrozen(CLAUDE_EXPLORATORY_VERSIONS)).toBe(true);
    });

    it('an exploratory claude-cli record passes CLAUDE_EXPLORATORY_VERSIONS itself to the Claude factory', async () => {
      const { deps, claudeVersions, agyVersions } = fakeDeps();
      const r = await openRoute({ route: 'claude-cli', exploratory: true }, deps, { mode: 'record' });
      expect(r.success).toBe(true);
      expect(claudeVersions).toHaveLength(1);
      expect(claudeVersions[0]).toBe(CLAUDE_EXPLORATORY_VERSIONS);
      expect(agyVersions).toEqual([]);
      expect(claudeExploratoryVersions({ route: 'claude-cli', exploratory: true })).toBe(CLAUDE_EXPLORATORY_VERSIONS);
      expect(agyExploratoryVersions({ route: 'claude-cli', exploratory: true })).toBeUndefined();
      expect(claudeExploratoryVersions({ route: 'gemini-agy', model: 'g', exploratory: true })).toBeUndefined();
    });

    it('without the exploratory label the Claude factory gets no extra versions (strict pin)', async () => {
      const { deps, claudeVersions } = fakeDeps();
      await openRoute({ route: 'claude-cli' }, deps, { mode: 'record' });
      expect(claudeVersions).toEqual([undefined]);
      expect(claudeExploratoryVersions({ route: 'claude-cli' })).toBeUndefined();
    });

    it('estimate and replay never reach the Claude factory, exploratory or not', async () => {
      const { deps, calls } = fakeDeps();
      for (const mode of ['estimate', 'replay'] as const) await openRoute({ route: 'claude-cli', exploratory: true }, deps, { mode });
      expect(calls).toEqual([]);
    });

    it('estimate and replay never reach the agy factory, exploratory or not', async () => {
      const { deps, calls } = fakeDeps();
      for (const mode of ['estimate', 'replay'] as const) await openRoute({ route: 'gemini-agy', model: 'g', exploratory: true }, deps, { mode });
      expect(calls).toEqual([]);
    });
  });

  it('the real gemini-api factory refuses to build a provider when the key is absent (no construction, no call)', async () => {
    let result: unknown;
    const reads = await keyReads(async () => { result = await DEFAULT_ROUTE_DEPS.geminiApi({ model: 'gemini-x', temperature: 0, maxTokens: 1 }); });
    expect(reads).toBe(1);
    expect(result).toMatchObject({ success: false, errors: [{ code: 'LLM_AUTH' }] });
  });
});
