/**
 * Ontology v0 model providers. The passes reach a model only through `OntologyProvider`:
 *
 * - `ClaudeCliOntologyProvider` reuses the judge's isolated Claude CLI route unchanged: the same `ClaudeCliProvider`
 *   (pinned CLI version, dedicated `CLAUDE_CONFIG_DIR`, allow-listed child env, neutral cwd, init probe; the prompt on
 *   stdin), with the ontology's own system prompt and JSON schema passed through the call context. It never reads
 *   credentials: the CLI reads its own login inside the judge config dir.
 * - `MockOntologyProvider` answers from a function, for tests and the recorded-fixture cassettes.
 * - `LlmOntologyProvider` (v1.4 U3) adapts any other `LLMProvider` (the Gemini API, the agy CLI); routes are opened
 *   through `routes.ts`.
 *
 * Errors keep the judge's codes. `LLM_USAGE_LIMIT`, `LLM_AUTH`, the isolation and version stops and a missing CLI end
 * the run (`STOP_CODES`); anything else is retried once, then the item is invalid.
 */
import type { LLMEffort, LLMProvider } from '../../shared/interfaces/llm-provider.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { parseEnvelope, resolveActualModel } from '../../llm-critic/claude-cli-provider.js';
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from '../../llm-critic/frozen.js';
import type { CallPass } from './types.js';

export interface OntologyModelRequest {
  readonly pass: CallPass;
  /** The item's stable id (a class node id, a group id, a pair key). */
  readonly itemId: string;
  /** A readable name of the item (class name, group id); metadata only. */
  readonly itemName: string;
  readonly runIndex: number;
  readonly system: string;
  readonly prompt: string;
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface OntologyModelResponse {
  readonly json: unknown;
  readonly model: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

export interface OntologyProviderDescription {
  readonly provider: string;
  readonly model: string;
  readonly effort?: string;
  /** Temperature actually sent; null when the route has no such option. */
  readonly temperature: number | null;
}

export interface OntologyProvider {
  describe(): OntologyProviderDescription;
  complete(request: OntologyModelRequest): Promise<DomainResult<OntologyModelResponse>>;
}

/** Error codes that end the whole run instead of failing one item. */
export const STOP_CODES: ReadonlySet<string> = new Set([
  'LLM_USAGE_LIMIT', 'LLM_AUTH', 'LLM_CLI_ISOLATION', 'LLM_CLI_VERSION_DRIFT', 'LLM_CLI_NOT_FOUND',
]);

// ── Mock ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A scripted failure a mock responder can return instead of an answer. */
export class MockFailure {
  constructor(readonly code: string, readonly message = code) {}
}

export type MockResponder = (request: OntologyModelRequest) => unknown;

export class MockOntologyProvider implements OntologyProvider {
  private readonly requests: OntologyModelRequest[] = [];

  constructor(private readonly responder: MockResponder, private readonly model = 'mock-ontology') {}

  describe(): OntologyProviderDescription {
    return { provider: 'mock', model: this.model, temperature: null };
  }

  /** Every request received, in call order. */
  received(): readonly OntologyModelRequest[] {
    return [...this.requests];
  }

  complete(request: OntologyModelRequest): Promise<DomainResult<OntologyModelResponse>> {
    this.requests.push(request);
    const answer = this.responder(request);
    if (answer instanceof MockFailure) return Promise.resolve(DomainResult.fail([{ code: answer.code, message: answer.message }]));
    return Promise.resolve(DomainResult.ok({
      json: answer,
      model: this.model,
      usage: { inputTokens: Math.ceil(request.prompt.length / 4), outputTokens: Math.ceil(JSON.stringify(answer).length / 4) },
    }));
  }
}

/** A provider that must never be called (replay runs: every answer comes from the cassettes). */
export class NoCallProvider implements OntologyProvider {
  constructor(private readonly description: OntologyProviderDescription) {}

  describe(): OntologyProviderDescription {
    return this.description;
  }

  complete(): Promise<DomainResult<OntologyModelResponse>> {
    return Promise.resolve(DomainResult.fail([{ code: 'ONTOLOGY_NO_CALL', message: 'replay provider was asked for a live call' }]));
  }
}

// ── Claude CLI (the judge's isolated route) ──────────────────────────────────────────────────────────────────────

export interface ClaudeCliOntologyOptions {
  readonly model?: string;
  readonly effort?: LLMEffort;
  readonly maxTokens?: number;
}

/**
 * Adapts the judge's `ClaudeCliProvider` (passed in already constructed, so the isolation set-up is the judge's own)
 * to the ontology port. The CLI answers with a reduced envelope; the structured output is taken from
 * `structured_output`, else from the `result` text when that is one JSON object. A model other than the requested
 * one carrying the output is an error (the judge's VRD-07 rule).
 */
export class ClaudeCliOntologyProvider implements OntologyProvider {
  private readonly model: string;
  private readonly effort: LLMEffort;
  private readonly maxTokens: number;

  constructor(private readonly inner: LLMProvider, options: ClaudeCliOntologyOptions = {}) {
    this.model = options.model ?? JUDGE_MODEL;
    this.effort = options.effort ?? JUDGE_EFFORT;
    this.maxTokens = options.maxTokens ?? JUDGE_MAX_TOKENS;
  }

  describe(): OntologyProviderDescription {
    const d = this.inner.describe();
    return { provider: d.provider, model: this.model, effort: this.effort, temperature: null };
  }

  async complete(request: OntologyModelRequest): Promise<DomainResult<OntologyModelResponse>> {
    const res = await this.inner.evaluate(request.prompt, { model: this.model, effort: this.effort, maxTokens: this.maxTokens }, {
      runIndex: request.runIndex,
      repetition: 0,
      functionId: `ontology:${request.pass}`,
      unitId: request.itemId,
      systemPrompt: request.system,
      responseSchema: JSON.stringify(request.schema),
    });
    if (!res.success) return DomainResult.fail(res.errors);
    const envelope = parseEnvelope(res.data.content);
    if (envelope === null) return DomainResult.fail([{ code: 'LLM_CLI_BAD_ENVELOPE', message: 'Claude CLI answer is not a JSON envelope' }]);
    const resolution = resolveActualModel(envelope, this.model);
    if (resolution.kind === 'mismatch') {
      return DomainResult.fail([{ code: 'LLM_MODEL_MISMATCH', message: `output carried by ${resolution.models.join(', ')}` }]);
    }
    let json: unknown = envelope.structured_output;
    if (json === undefined && typeof envelope.result === 'string') {
      try {
        json = JSON.parse(envelope.result);
      } catch {
        return DomainResult.fail([{ code: 'LLM_BAD_JSON', message: 'no structured output and the result text is not JSON' }]);
      }
    }
    return DomainResult.ok({ json, model: resolution.resolvedModel, usage: res.data.usage });
  }
}

// ── Any LLMProvider (vendor-neutral route; v1.4 U3, design §3.5) ─────────────────────────────────────────────────

/** Routes whose served-model check accepts a dated variant (`<requested>-<suffix>`). */
const DATED_VARIANT_ROUTES: ReadonlySet<string> = new Set(['gemini-api']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nullableNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(nullableNode);
  if (!isRecord(node)) return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'type' && Array.isArray(v) && v.length === 2 && v.includes('null')) {
      out.type = v.find((t) => t !== 'null');
      out.nullable = true;
    } else {
      out[k] = nullableNode(v);
    }
  }
  return out;
}

/**
 * The pass schema in the form a vendor accepts. `gemini-api`: every `type: [T, 'null']` becomes
 * `{ type: T, nullable: true }` (`GeminiProvider` then keeps its supported subset). Other routes take the schema as is.
 * `ModelCaller` still validates every answer against the original schema with Ajv, so nothing is relaxed.
 */
export function toVendorSchema(route: string, schema: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return route === 'gemini-api' ? nullableNode(schema) as Record<string, unknown> : schema;
}

export interface LlmOntologyOptions {
  /** The route name, which is also the provider name in the cache key (`gemini-api`, `gemini-agy`). */
  readonly route: string;
  readonly model: string;
  readonly maxTokens: number;
  /** Sent when set; `describe().temperature` reports it (null when unset). */
  readonly temperature?: number;
}

/**
 * Adapts any `LLMProvider` (the Gemini API, the agy CLI) to the ontology port: the system prompt and the vendor form
 * of the pass schema go through the call context, the answer text is parsed as JSON (a failure is `LLM_BAD_JSON`,
 * which `ModelCaller` retries once), and the served model must be the requested one (VRD-07; `gemini-api` may serve
 * a dated variant). Error codes pass through unchanged, so the stop codes keep working.
 */
export class LlmOntologyProvider implements OntologyProvider {
  constructor(private readonly inner: LLMProvider, private readonly options: LlmOntologyOptions) {}

  describe(): OntologyProviderDescription {
    return { provider: this.options.route, model: this.options.model, temperature: this.options.temperature ?? null };
  }

  async complete(request: OntologyModelRequest): Promise<DomainResult<OntologyModelResponse>> {
    const { model, maxTokens, temperature, route } = this.options;
    const res = await this.inner.evaluate(request.prompt, { model, maxTokens, ...(temperature !== undefined ? { temperature } : {}) }, {
      runIndex: request.runIndex,
      repetition: 0,
      functionId: `ontology:${request.pass}`,
      unitId: request.itemId,
      systemPrompt: request.system,
      responseSchema: JSON.stringify(toVendorSchema(route, request.schema)),
    });
    if (!res.success) return DomainResult.fail(res.errors);
    const served = res.data.model;
    if (served !== model && !(DATED_VARIANT_ROUTES.has(route) && served.startsWith(`${model}-`))) {
      return DomainResult.fail([{ code: 'LLM_MODEL_MISMATCH', message: `requested ${model}, served ${served}` }]);
    }
    let json: unknown;
    try {
      json = JSON.parse(res.data.content);
    } catch {
      return DomainResult.fail([{ code: 'LLM_BAD_JSON', message: `${route} answer is not JSON` }]);
    }
    return DomainResult.ok({ json, model: served, usage: res.data.usage });
  }
}
