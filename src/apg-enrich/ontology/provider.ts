/**
 * Ontology v0 model providers. The passes reach a model only through `OntologyProvider`:
 *
 * - `ClaudeCliOntologyProvider` reuses the judge's isolated Claude CLI route unchanged: the same `ClaudeCliProvider`
 *   (pinned CLI version, dedicated `CLAUDE_CONFIG_DIR`, allow-listed child env, neutral cwd, init probe; the prompt on
 *   stdin), with the ontology's own system prompt and JSON schema passed through the call context. It never reads
 *   credentials: the CLI reads its own login inside the judge config dir.
 * - `MockOntologyProvider` answers from a function, for tests and the recorded-fixture cassettes.
 *
 * Errors keep the judge's codes. `LLM_USAGE_LIMIT`, `LLM_AUTH`, the isolation and version stops and a missing CLI end
 * the run (`STOP_CODES`); anything else is retried once, then the item is invalid.
 */
import type { LLMEffort, LLMProvider } from '../../shared/interfaces/llm-provider.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { parseEnvelope, resolveActualModel } from '../../llm-critic/claude-cli-provider.js';
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from '../../llm-critic/frozen.js';
import type { PassId } from './types.js';

export interface OntologyModelRequest {
  readonly pass: PassId;
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
