/**
 * Ontology model routes (v1.4 U3, design §3.5; BR-U3-12 to -14): one registry for every vendor.
 *
 * - `claude-cli`: the judge's isolated Claude CLI route, as before (`ClaudeCliOntologyProvider`).
 * - `gemini-api`: `GeminiProvider` through `LlmOntologyProvider`. Needs `--model` (no default, BR-U3-13) and a
 *   temperature. The API key is read from `process.env.GEMINI_API_KEY` by the factory only, when a live record opens.
 * - `gemini-agy`: `AgyCliProvider` (its home `LABELLER_AGY_HOME`, else `AGY_HOME_DEFAULT`, and its isolation
 *   pre-flight) through `LlmOntologyProvider`. Needs `--model`. agy sends no temperature. The pre-flight holds the
 *   frozen labeller pin (`AGY_PINNED_VERSION`, 1.3.2) unless the spec is `exploratory`: then the shared
 *   `AGY_EXPLORATORY_VERSIONS` list (the BF-01 one, not a copy) is also accepted (C4-01 §3 gap 2).
 * - `mock`: the scripted answers; the runner builds it per project.
 *
 * `describeRoute` is pure (no I/O, no environment, no construction). `openRoute` builds a live provider only in record
 * mode, and only through the injected factories (`RouteDeps`); estimate and replay get a `NoCallProvider`, so no
 * credential is read and nothing can be called. Tests pass fake factories; `DEFAULT_ROUTE_DEPS` holds the real ones.
 * Nothing here loads `.env`.
 */
import * as path from 'node:path';
import { AGY_EXPLORATORY_VERSIONS, AGY_HOME_DEFAULT, AgyCliProvider, expandHome } from '../../llm-critic/agy-cli-provider.js';
import { ClaudeCliProvider } from '../../llm-critic/claude-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from '../../llm-critic/frozen.js';
import { GeminiProvider } from '../../llm-critic/gemini-provider.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import type { LLMProvider } from '../../shared/interfaces/llm-provider.js';
import { NodeProcessRunner } from '../../shared/process/node-process-runner.js';
import { ClaudeCliOntologyProvider, LlmOntologyProvider, NoCallProvider } from './provider.js';
import type { OntologyProvider, OntologyProviderDescription } from './provider.js';

export const ONTOLOGY_ROUTES = ['claude-cli', 'gemini-api', 'gemini-agy', 'mock'] as const;
export type OntologyRouteName = (typeof ONTOLOGY_ROUTES)[number];

export const MOCK_ONTOLOGY_MODEL = 'mock-ontology';

export interface OntologyRouteSpec {
  readonly route: OntologyRouteName;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** An exploratory run (gemini-agy only): the agy pre-flight also accepts `AGY_EXPLORATORY_VERSIONS`. */
  readonly exploratory?: boolean;
}

/** The agy versions a route's pre-flight accepts besides the pin: the shared exploratory list, or none. */
export function agyExploratoryVersions(spec: OntologyRouteSpec): readonly string[] | undefined {
  return spec.route === 'gemini-agy' && spec.exploratory === true ? AGY_EXPLORATORY_VERSIONS : undefined;
}

export function isOntologyRoute(name: string): name is OntologyRouteName {
  return (ONTOLOGY_ROUTES as readonly string[]).includes(name);
}

/** A route spec's errors, without I/O: a Gemini route needs a model, and `gemini-api` a temperature. */
export function checkRoute(spec: OntologyRouteSpec): DomainResult<void> {
  const errors: { code: string; message: string }[] = [];
  if ((spec.route === 'gemini-api' || spec.route === 'gemini-agy') && (spec.model === undefined || spec.model === '')) {
    errors.push({ code: 'ONTOLOGY_ROUTE_NO_MODEL', message: `--provider ${spec.route} needs --model <id>: a Gemini route has no default model (BR-U3-13)` });
  }
  if (spec.route === 'gemini-api' && spec.temperature === undefined) {
    errors.push({ code: 'ONTOLOGY_ROUTE_NO_TEMPERATURE', message: '--provider gemini-api needs a temperature (--temperature <t>)' });
  }
  if (spec.route === 'gemini-agy' && spec.temperature !== undefined) {
    errors.push({ code: 'ONTOLOGY_ROUTE_TEMPERATURE_UNSENT', message: 'agy sends no temperature; drop --temperature for gemini-agy' });
  }
  if (spec.exploratory === true && spec.route !== 'gemini-agy') {
    errors.push({ code: 'ONTOLOGY_ROUTE_EXPLORATORY_AGY_ONLY', message: '--exploratory widens the agy version pin only; it applies to gemini-agy alone' });
  }
  return errors.length > 0 ? DomainResult.fail(errors) : DomainResult.ok(undefined);
}

/** What a route will report as provider and model (the cache key), with no I/O. Throws on an invalid spec. */
export function describeRoute(spec: OntologyRouteSpec): OntologyProviderDescription {
  const ok = checkRoute(spec);
  if (!ok.success) throw new Error(ok.errors.map((e) => e.message).join('; '));
  switch (spec.route) {
    case 'claude-cli': return { provider: 'claude-cli', model: spec.model ?? JUDGE_MODEL, effort: JUDGE_EFFORT, temperature: null };
    case 'mock': return { provider: 'mock', model: spec.model ?? MOCK_ONTOLOGY_MODEL, temperature: null };
    case 'gemini-api': return { provider: 'gemini-api', model: spec.model ?? '', temperature: spec.temperature ?? null };
    case 'gemini-agy': return { provider: 'gemini-agy', model: spec.model ?? '', temperature: null };
  }
}

export interface OpenedRoute {
  readonly provider: OntologyProvider;
  readonly dispose: () => void;
  /** A line to print once the route is ready (pre-flight result), or null. */
  readonly ready: string | null;
}

export interface ClaudeCliRouteConfig {
  readonly binary: string;
  readonly judgeConfigDir: string;
  readonly model: string;
}

/** Live-provider factories. The only place that builds a vendor provider or reads its credentials or home. */
export interface RouteDeps {
  claudeCli(cfg: ClaudeCliRouteConfig): Promise<DomainResult<OpenedRoute>>;
  geminiApi(cfg: { readonly model: string; readonly temperature: number; readonly maxTokens: number }): Promise<DomainResult<LLMProvider>>;
  agyCli(cfg: { readonly model: string; readonly exploratoryVersions?: readonly string[] }): Promise<DomainResult<LLMProvider>>;
}

export type RouteMode = 'record' | 'replay' | 'estimate';

/**
 * Opens a route. `replay` and `estimate` return a `NoCallProvider` and never call a factory (BR-U3-12). `mock` is built
 * by the runner per project (its scripted answers), so it is refused here in record mode.
 */
export async function openRoute(spec: OntologyRouteSpec, deps: RouteDeps, opts: { readonly mode: RouteMode; readonly claude?: Omit<ClaudeCliRouteConfig, 'model'> }): Promise<DomainResult<OpenedRoute>> {
  const ok = checkRoute(spec);
  if (!ok.success) return DomainResult.fail(ok.errors);
  if (opts.mode !== 'record') return DomainResult.ok({ provider: new NoCallProvider(describeRoute(spec)), dispose: () => undefined, ready: null });
  const maxTokens = spec.maxTokens ?? JUDGE_MAX_TOKENS;
  switch (spec.route) {
    case 'mock':
      return DomainResult.fail([{ code: 'ONTOLOGY_ROUTE_MOCK', message: 'the mock route is built per project from its scripted answers' }]);
    case 'claude-cli':
      return deps.claudeCli({ binary: opts.claude?.binary ?? 'claude', judgeConfigDir: opts.claude?.judgeConfigDir ?? JUDGE_CONFIG_DIR_DEFAULT, model: spec.model ?? JUDGE_MODEL });
    case 'gemini-api': {
      const model = spec.model ?? '';
      const temperature = spec.temperature ?? 0;
      const inner = await deps.geminiApi({ model, temperature, maxTokens });
      if (!inner.success) return DomainResult.fail(inner.errors);
      return DomainResult.ok({ provider: new LlmOntologyProvider(inner.data, { route: 'gemini-api', model, maxTokens, temperature }), dispose: () => undefined, ready: `gemini-api route ready: model ${model}, temperature ${String(temperature)}` });
    }
    case 'gemini-agy': {
      const model = spec.model ?? '';
      const exploratoryVersions = agyExploratoryVersions(spec);
      const inner = await deps.agyCli({ model, ...(exploratoryVersions !== undefined ? { exploratoryVersions } : {}) });
      if (!inner.success) return DomainResult.fail(inner.errors);
      return DomainResult.ok({ provider: new LlmOntologyProvider(inner.data, { route: 'gemini-agy', model, maxTokens }), dispose: () => undefined, ready: `gemini-agy route ready: model ${model}${exploratoryVersions !== undefined ? ' (exploratory: agy versions beyond the pin accepted)' : ''}` });
    }
  }
}

/** The real factories. Never called by a test, an estimate or a replay. */
export const DEFAULT_ROUTE_DEPS: RouteDeps = Object.freeze({
  async claudeCli(cfg: ClaudeCliRouteConfig): Promise<DomainResult<OpenedRoute>> {
    const cli = new ClaudeCliProvider({ binary: cfg.binary, judgeConfigDir: expandHome(cfg.judgeConfigDir), mode: 'record', projectRoot: path.resolve('.') }, { runner: new NodeProcessRunner() });
    const prepared = await cli.prepare();
    if (!prepared.success) {
      cli.dispose();
      return DomainResult.fail(prepared.errors);
    }
    return DomainResult.ok({
      provider: new ClaudeCliOntologyProvider(cli, { model: cfg.model }),
      dispose: () => { cli.dispose(); },
      ready: `judge route ready: CLI ${prepared.data.cliVersion}, probe ${prepared.data.isolationProbeSha256.slice(0, 12)}`,
    });
  },
  geminiApi(cfg: { readonly model: string; readonly temperature: number; readonly maxTokens: number }): Promise<DomainResult<LLMProvider>> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey === undefined || apiKey === '') return Promise.resolve(DomainResult.fail([{ code: 'LLM_AUTH', message: 'GEMINI_API_KEY is not set in the environment' }]));
    return Promise.resolve(DomainResult.ok(new GeminiProvider({ apiKey, model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens })));
  },
  async agyCli(cfg: { readonly model: string; readonly exploratoryVersions?: readonly string[] }): Promise<DomainResult<LLMProvider>> {
    const agy = new AgyCliProvider({
      model: cfg.model, home: expandHome(process.env.LABELLER_AGY_HOME ?? AGY_HOME_DEFAULT), mode: 'record',
      ...(cfg.exploratoryVersions !== undefined ? { exploratoryVersions: cfg.exploratoryVersions } : {}),
    }, { runner: new NodeProcessRunner() });
    const prepared = await agy.prepare();
    return prepared.success ? DomainResult.ok(agy) : DomainResult.fail(prepared.errors);
  },
});
